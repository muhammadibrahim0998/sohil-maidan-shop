import express from 'express';
import Customer from '../models/Customer.js';
import Item from '../models/Item.js';
import User from '../models/User.js';

const router = express.Router();

// ─── Middleware: Verify customer session via token ───────────────────────────
const authenticateCustomer = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  const customerId = authHeader.split(' ')[1];
  try {
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(401).json({ message: 'Invalid session' });
    req.customer = customer;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid session' });
  }
};

import { resolveShopId } from '../utils/shopResolver.js';

// ─── GET ALL CUSTOMERS (FOR ADMIN DASHBOARD) ──────────────────────────────────
router.get('/all', async (req, res) => {
  try {
    const { shopId } = req.query;
    let filter = {};
    if (shopId) {
      const resolved = await resolveShopId(shopId);
      if (resolved) {
        filter = { shopId: resolved };
      }
    }
    const customers = await Customer.find(filter).select('-password');
    res.json({ success: true, count: customers.length, customers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── REGISTER ────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, shopId } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const targetShopId = (await resolveShopId(shopId)) || shopId || 1;
    const existing = await Customer.findOne({ email, shopId: targetShopId });
    if (existing) return res.status(409).json({ message: 'Email already registered for this shop' });

    const customer = await Customer.create({ fullName, email, password, shopId: targetShopId });

    res.status(201).json({
      success: true,
      message: 'Registered successfully',
      customerId: customer._id || customer.id,
      fullName: customer.fullName,
      email: customer.email
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password, shopId } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const targetShopId = (await resolveShopId(shopId)) || shopId || 1;
    
    // 1. Try Customer Login
    const customer = await Customer.findOne({ email, shopId: targetShopId });
    if (customer && (await customer.comparePassword(password))) {
      return res.json({
        success: true,
        customerId: customer._id || customer.id,
        fullName: customer.fullName,
        email: customer.email,
        cart: customer.cart || [],
        role: 'customer'
      });
    }

    // 2. Try User (Shop Admin) Login as fallback
    // Some shop admins use the Customer Storefront and expect to login there.
    const user = await User.findOne({ $or: [{ email: email }, { username: email }] });
    if (user && (await user.comparePassword(password))) {
      // Create a JWT token for the user so they can act as an admin!
      const jwt = (await import('jsonwebtoken')).default;
      const token = jwt.sign(
        { id: user._id, role: user.role, shopId: user.shopId },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '1d' }
      );

      return res.json({
        success: true,
        customerId: user._id, // map _id to customerId so frontend context doesn't break
        fullName: user.fullName,
        email: user.email || user.username,
        cart: [],
        role: user.role,
        token: token
      });
    }

    // If neither matches
    return res.status(401).json({ message: 'Invalid email/username or password' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET CART ─────────────────────────────────────────────────────────────────
router.get('/cart', authenticateCustomer, (req, res) => {
  res.json({ cart: req.customer.cart });
});

// ─── ADD TO CART (SUPPORTS SINGLE OR MULTIPLE DYNAMIC PRODUCTS) ─────────────
router.post('/cart', authenticateCustomer, async (req, res) => {
  try {
    const { itemId, quantity = 1, unit = 'egg', items, price, name, image } = req.body;
    const customer = req.customer;
    if (!Array.isArray(customer.cart)) {
      customer.cart = [];
    }

    // Support multiple products in a single call or standard single product
    const incomingItems = (Array.isArray(items) && items.length > 0)
      ? items
      : (itemId ? [{ itemId, quantity, unit, price, name, image }] : []);

    if (incomingItems.length === 0) {
      return res.status(400).json({ message: 'No product specified to add to cart' });
    }

    for (const inItem of incomingItems) {
      const itId = inItem.itemId || inItem.productId || inItem._id || inItem.id;
      if (!itId) continue;
      const itQty = Math.max(1, Number(inItem.quantity) || 1);
      const itUnit = String(inItem.unit || 'egg').toLowerCase();

      let item = null;
      try {
        item = await Item.findById(itId);
      } catch (_) {}

      let finalPrice = Number(inItem.price) || 0;
      if (!finalPrice && item) {
        const basePrice = Number(item.price) || 0;
        const pEgg = Number(item.pricePerEgg) || 0;
        const pTray = Number(item.pricePerTray) || 0;
        const pPeti = Number(item.pricePerPeti) || 0;
        const uType = String(item.unitType || 'tray').toLowerCase();

        let eggRate = pEgg;
        if (!eggRate && pTray > 0) eggRate = pTray / 30;
        else if (!eggRate && pPeti > 0) eggRate = pPeti / 360;
        else if (!eggRate && basePrice > 0) {
          eggRate = uType === 'peti' ? basePrice / 360 : uType === 'tray' ? basePrice / 30 : basePrice;
        }
        if (!eggRate) eggRate = 30;

        finalPrice = Math.round(eggRate);
        if (itUnit === 'peti') {
          finalPrice = pPeti > 0 ? pPeti : pTray > 0 ? pTray * 12 : Math.round(eggRate * 360);
        } else if (itUnit === 'tray') {
          finalPrice = pTray > 0 ? pTray : pPeti > 0 ? Math.round(pPeti / 12) : Math.round(eggRate * 30);
        }
      }

      const unitLabel = itUnit === 'peti' ? 'Peti' : itUnit === 'tray' ? 'Tray' : 'Egg';
      const rawName = item?.name || inItem.name || 'Egg Product';
      const cleanName = rawName.replace(/\s*\((Peti|Tray|Egg)\)/gi, '').trim();
      const itemImg = (item && item.images && item.images[0]) || item?.image || inItem.image || inItem.images?.[0] || '';

      const existing = customer.cart.find(c =>
        String(c.itemId || c.productId || c.id || c._id) === String(itId) &&
        String(c.unit || 'egg').toLowerCase() === itUnit
      );

      if (existing) {
        existing.quantity = (Number(existing.quantity) || 0) + itQty;
        if (finalPrice > 0) existing.price = finalPrice;
      } else {
        customer.cart.push({
          itemId: itId,
          productId: itId,
          id: itId,
          _id: itId,
          name: `${cleanName} (${unitLabel})`,
          unit: itUnit,
          price: finalPrice,
          image: itemImg,
          quantity: itQty
        });
      }
    }

    // Merge any existing duplicate cart entries
    const mergedCart = [];
    for (const c of customer.cart) {
      const match = mergedCart.find(m =>
        String(m.itemId || m.productId || m.id || m._id) === String(c.itemId || c.productId || c.id || c._id) &&
        String(m.unit || 'egg').toLowerCase() === String(c.unit || 'egg').toLowerCase()
      );
      if (match) {
        match.quantity = (Number(match.quantity) || 0) + (Number(c.quantity) || 0);
      } else {
        mergedCart.push(c);
      }
    }
    customer.cart = mergedCart;

    await customer.save();
    res.json({ success: true, cart: customer.cart });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── UPDATE CART ITEM QTY / UNIT ──────────────────────────────────────────────
router.put('/cart/:itemId', authenticateCustomer, async (req, res) => {
  try {
    const { quantity, unit, newUnit } = req.body;
    const customer = req.customer;
    if (!Array.isArray(customer.cart)) customer.cart = [];
    const currentUnit = String(unit || 'egg').toLowerCase();
    const targetItemId = String(req.params.itemId);

    let cartItem = customer.cart.find(c =>
      String(c.itemId || c.productId || c.id || c._id) === targetItemId &&
      String(c.unit || 'egg').toLowerCase() === currentUnit
    );

    // Fallback: match by ID alone if unit wasn't matched
    if (!cartItem) {
      cartItem = customer.cart.find(c =>
        String(c.itemId || c.productId || c.id || c._id) === targetItemId
      );
    }

    if (!cartItem) return res.status(404).json({ message: 'Item not in cart' });

    if (quantity !== undefined) {
      const parsedQty = Number(quantity);
      if (parsedQty <= 0) {
        customer.cart = customer.cart.filter(c => c !== cartItem);
      } else {
        cartItem.quantity = parsedQty;
      }
    }

    if (newUnit && String(newUnit).toLowerCase() !== String(cartItem.unit || 'egg').toLowerCase()) {
      const toUnit = String(newUnit).toLowerCase();
      let item = null;
      try { item = await Item.findById(targetItemId); } catch (_) {}

      const basePrice = Number(item?.price) || 0;
      const pEgg = Number(item?.pricePerEgg) || 0;
      const pTray = Number(item?.pricePerTray) || 0;
      const pPeti = Number(item?.pricePerPeti) || 0;
      const uType = String(item?.unitType || 'tray').toLowerCase();

      let eggRate = pEgg;
      if (!eggRate && pTray > 0) eggRate = pTray / 30;
      else if (!eggRate && pPeti > 0) eggRate = pPeti / 360;
      else if (!eggRate && basePrice > 0) {
        eggRate = uType === 'peti' ? basePrice / 360 : uType === 'tray' ? basePrice / 30 : basePrice;
      }
      if (!eggRate) eggRate = 30;

      let unitPrice = Math.round(eggRate);
      if (toUnit === 'peti') {
        unitPrice = pPeti > 0 ? pPeti : pTray > 0 ? pTray * 12 : Math.round(eggRate * 360);
      } else if (toUnit === 'tray') {
        unitPrice = pTray > 0 ? pTray : pPeti > 0 ? Math.round(pPeti / 12) : Math.round(eggRate * 30);
      }

      const unitLabel = toUnit === 'peti' ? 'Peti' : toUnit === 'tray' ? 'Tray' : 'Egg';
      const cleanName = (cartItem.name || 'Egg Product').replace(/\s*\((Peti|Tray|Egg)\)/gi, '').trim();

      // Check if item with newUnit already exists in cart, merge if so
      const existingNewUnitItem = customer.cart.find(c =>
        c !== cartItem &&
        String(c.itemId || c.productId || c.id || c._id) === targetItemId &&
        String(c.unit || 'egg').toLowerCase() === toUnit
      );

      if (existingNewUnitItem) {
        existingNewUnitItem.quantity = (Number(existingNewUnitItem.quantity) || 0) + (Number(cartItem.quantity) || 1);
        customer.cart = customer.cart.filter(c => c !== cartItem);
      } else {
        cartItem.unit = toUnit;
        cartItem.price = unitPrice;
        cartItem.name = `${cleanName} (${unitLabel})`;
      }
    }

    await customer.save();
    res.json({ success: true, cart: customer.cart });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── REMOVE FROM CART ────────────────────────────────────────────────────────
router.delete('/cart/:itemId', authenticateCustomer, async (req, res) => {
  try {
    const customer = req.customer;
    if (!Array.isArray(customer.cart)) customer.cart = [];
    const targetItemId = String(req.params.itemId);
    const { unit } = req.query;

    if (unit) {
      const u = String(unit).toLowerCase();
      customer.cart = customer.cart.filter(c =>
        !(String(c.itemId || c.productId || c.id || c._id) === targetItemId &&
          String(c.unit || 'egg').toLowerCase() === u)
      );
    } else {
      customer.cart = customer.cart.filter(c =>
        String(c.itemId || c.productId || c.id || c._id) !== targetItemId
      );
    }

    await customer.save();
    res.json({ success: true, cart: customer.cart });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── CLEAR CART ───────────────────────────────────────────────────────────────
router.delete('/cart', authenticateCustomer, async (req, res) => {
  try {
    req.customer.cart = [];
    await req.customer.save();
    res.json({ success: true, cart: [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── UPDATE CUSTOMER (ADMIN / STORE) ──────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, address } = req.body;
    if (!id) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }
    const updateData = {};
    if (fullName) updateData.fullName = fullName.trim();
    if (email) updateData.email = email.trim().toLowerCase();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (address !== undefined) updateData.address = address.trim();

    const customer = await Customer.findByIdAndUpdate(id, updateData, { new: true });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json({ success: true, customer });
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── DELETE CUSTOMER (ADMIN ONLY) ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }
    const customer = await Customer.findByIdAndDelete(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json({ success: true, message: 'Customer account deleted successfully' });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
