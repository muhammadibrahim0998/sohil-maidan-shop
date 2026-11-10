import express from 'express';
import Stripe from 'stripe';
import Order from '../models/Order.js';
import Customer from '../models/Customer.js';
import Sale from '../models/Sale.js';
import Item, { getBranchItemModel } from '../models/Item.js';
import Settings from '../models/Settings.js';
import EasyPaisa from '../models/EasyPaisa.js';
import crypto from 'crypto';
import { authenticate, requireShopAdmin } from '../middleware/auth.js';
import pool from '../config/db.js';

const router = express.Router();
// Initialize stripe with dummy key if not present in env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');

// Middleware to verify customer (supports logged-in token OR guest customer with contact info)
const authenticateCustomer = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const customerId = authHeader.split(' ')[1];
    try {
      const customer = await Customer.findById(customerId);
      if (customer) {
        req.customer = customer;
        return next();
      }
    } catch {}
  }

  // Fallback: Check if contact info was provided in body
  const { shippingDetails, phone, fullName, email } = req.body || {};
  const cPhone = shippingDetails?.phone || phone || '';
  const cName = shippingDetails?.fullName || fullName || 'Online Customer';
  const cEmail = shippingDetails?.email || email || '';

  if (cPhone || cName) {
    try {
      let cust = null;
      if (cPhone) {
        cust = await Customer.findOne({ phone: cPhone });
      }
      if (!cust) {
        cust = await Customer.create({
          fullName: cName,
          phone: cPhone,
          email: cEmail || `guest_${Date.now()}@pos.pk`,
          shopId: req.body?.shopId || null,
          role: 'customer',
          cart: []
        });
      }
      req.customer = cust;
      return next();
    } catch (e) {
      req.customer = {
        _id: 'guest_' + Date.now(),
        id: 'guest_' + Date.now(),
        fullName: cName,
        phone: cPhone,
        email: cEmail,
        shopId: req.body?.shopId || null,
        cart: []
      };
      return next();
    }
  }

  return res.status(401).json({ message: 'Customer authentication or shipping contact details required' });
};

// Handler for processing single or multiple product checkouts
const handleCheckoutProcess = async (req, res) => {
  try {
    const { paymentMethod, shippingDetails, items, shopId: reqShopId } = req.body;
    const customer = req.customer;

    // Dynamically retrieve multiple items from body, or fallback to customer cart
    let orderItems = [];
    if (Array.isArray(items) && items.length > 0) {
      orderItems = items.map(item => ({
        itemId: item.itemId || item.productId || item._id || item.id,
        productId: item.productId || item.itemId || item._id || item.id,
        name: item.name || 'Egg Product',
        unit: item.unit || 'egg',
        price: Number(item.price) || 0,
        costPrice: Number(item.costPrice) || 0,
        quantity: Math.max(1, Number(item.quantity) || 1),
        image: item.image || item.images?.[0] || ''
      }));
    } else if (customer && Array.isArray(customer.cart) && customer.cart.length > 0) {
      orderItems = customer.cart;
    } else {
      return res.status(400).json({ message: 'Cart or items list is empty. Please select products to order.' });
    }

    // Calculate dynamic total amount
    const totalAmount = orderItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);
    const shopId = reqShopId || customer.shopId || null;

    // Strict Dynamic Stock Validation for Online Storefront Orders
    for (const item of orderItems) {
      const prodId = item.productId || item.itemId;
      if (prodId) {
        const product = await Item.findById(prodId);
        if (product) {
          const availStock = Number(product.stock) || 0;
          const qty = Number(item.quantity) || 1;
          const uType = String(item.unit || product.unitType || 'egg').toLowerCase();
          const tPerP = Number(product.traysPerPeti) || 12;
          const ePerT = Number(product.eggsPerTray) || 30;
          const ePerP = tPerP * ePerT || 360;
          const eggsRequired = uType.includes('peti') ? qty * ePerP : (uType.includes('tray') ? qty * ePerT : qty);

          if (availStock <= 0) {
            return res.status(400).json({
              success: false,
              message: `Cannot place order: Product "${product.name}" is completely Out of Stock (0 remaining). Please remove it from cart.`
            });
          }
          if (eggsRequired > availStock) {
            return res.status(400).json({
              success: false,
              message: `Cannot place order: Insufficient stock for "${product.name}". Available: ${availStock} eggs, but requested: ${eggsRequired} eggs.`
            });
          }
        }
      }
    }

    // Create Order with all multiple items
    const order = await Order.create({
      shopId,
      customerId: customer._id || customer.id,
      items: orderItems,
      totalAmount,
      shippingDetails,
      paymentMethod,
      paymentStatus: 'PENDING'
    });

    // Automatically record this online customer transaction into Sale collection
    try {
      const saleItems = orderItems.map(item => {
        const qty = Number(item.quantity) || 1;
        const pr = Number(item.price) || 0;
        const cp = Number(item.costPrice || 0);
        return {
          productId: item.productId || item.itemId || item._id || item.id,
          name: item.name,
          unit: item.unit || 'egg',
          quantity: qty,
          price: pr,
          costPrice: cp,
          subtotal: pr * qty,
          profit: (pr - cp) * qty
        };
      });

      await Sale.create({
        shopId,
        orderId: order._id || order.id,
        items: saleItems,
        totalAmount,
        totalProfit: saleItems.reduce((s, i) => s + (i.profit || 0), 0),
        saleDate: new Date(),
        status: 'completed',
        cashierName: 'Online Storefront',
        customerName: customer.fullName || shippingDetails?.fullName || 'Online Customer',
        customerPhone: customer.phone || shippingDetails?.phone || '',
        customerEmail: customer.email || shippingDetails?.email || '',
        customerId: customer._id || customer.id,
        paymentMethod: paymentMethod === 'COD' ? 'CASH' : (paymentMethod === 'STRIPE' ? 'ONLINE' : 'BANK_TRANSFER'),
        cashPaid: paymentMethod === 'COD' ? totalAmount : 0,
        bankPaid: (paymentMethod === 'STRIPE' || paymentMethod === 'EASYPAISA' || paymentMethod === 'BANK') ? totalAmount : 0,
        dueAmount: 0,
        isOnlineOrder: true,
        orderSource: 'ONLINE_STOREFRONT'
      });

      // Deduct stock for ordered items
      for (const item of orderItems) {
        const prodId = item.productId || item.itemId;
        if (prodId) {
          const product = await Item.findById(prodId);
          if (product) {
            const qty = Number(item.quantity) || 1;
            const uType = String(item.unit || product.unitType || 'egg').toLowerCase();
            const tPerP = Number(product.traysPerPeti) || 12;
            const ePerT = Number(product.eggsPerTray) || 30;
            const ePerP = tPerP * ePerT || 360;
            const eggsToDeduct = uType.includes('peti') ? qty * ePerP : (uType.includes('tray') ? qty * ePerT : qty);
            const newStock = Math.max(0, (Number(product.stock) || 0) - eggsToDeduct);
            const newPetis = Math.max(0, Number((newStock / ePerP).toFixed(2)));
            const newTrays = Math.max(0, Math.round(newStock / ePerT));
            await Item.findByIdAndUpdate(product.id || product._id, {
              stock: newStock,
              petiQuantity: newPetis,
              trayQuantity: newTrays,
              eggQuantity: newStock,
              lastUpdated: new Date().toISOString().split('T')[0]
            });

            try {
              const pIdVal = Number(product.id || product._id);
              if (pIdVal) {
                await pool.query(
                  'UPDATE purchases SET petiQuantity = ?, trayQuantity = ?, eggQuantity = ? WHERE itemId = ?',
                  [newPetis, newTrays, newStock, pIdVal]
                );
              }
            } catch (_) {}
          }
        }
      }
    } catch (saleErr) {
      console.error('Failed to create sale or deduct stock for order:', saleErr);
    }

    if (paymentMethod === 'COD') {
      // Clear customer cart if persisted in DB
      if (customer && typeof customer.save === 'function') {
        customer.cart = [];
        try { await customer.save(); } catch (e) {}
      }
      return res.json({ 
        success: true, 
        message: 'Order placed successfully (COD)', 
        orderId: order._id, 
        itemsCount: orderItems.length,
        totalAmount 
      });
    }
    else if (paymentMethod === 'STRIPE') {
      // Create Stripe Checkout Session for all items
      const line_items = orderItems.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
            images: item.image ? [item.image] : [],
          },
          unit_amount: Math.round(Number(item.price) * 100),
        },
        quantity: Math.max(1, Number(item.quantity) || 1),
      }));

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items,
        mode: 'payment',
        success_url: `${frontendUrl}/store?payment=success&orderId=${order._id}`,
        cancel_url: `${frontendUrl}/store?payment=cancel`,
        metadata: {
          orderId: order._id.toString()
        }
      });

      if (customer && typeof customer.save === 'function') {
        customer.cart = [];
        try { await customer.save(); } catch (e) {}
      }

      return res.json({ success: true, sessionId: session.id, url: session.url });
    }
    else if (paymentMethod === 'EASYPAISA' || paymentMethod === 'BANK') {
      // Fetch this shop's EasyPaisa number from Settings
      let easypaisaNumber = process.env.SUPERADMIN_EASYPAISA_NUMBER || '03098216202';
      let accountTitle = 'Super Admin';
      let easypaisaEnabled = true;

      if (shopId) {
        const shopSettings = await Settings.findOne({ shopId });
        if (shopSettings && shopSettings.easypaisaNumber) {
          easypaisaNumber = shopSettings.easypaisaNumber;
          easypaisaEnabled = shopSettings.easypaisaEnabled !== false;
          accountTitle = shopSettings.ownerFullName || shopSettings.shopName || 'Shop Admin';
        }
      }

      if (!easypaisaEnabled) {
        return res.status(400).json({ message: 'EasyPaisa payment is not enabled for this shop' });
      }

      try {
        await EasyPaisa.create({
          shopId: order.shopId,
          orderId: order._id || order.id,
          customerId: customer._id || customer.id,
          customerName: shippingDetails?.fullName || customer.fullName || 'Customer',
          customerPhone: shippingDetails?.phone || customer.phone || '',
          transactionId: '',
          senderNumber: shippingDetails?.phone || '',
          amount: totalAmount,
          status: 'PENDING',
          items: orderItems
        });
      } catch (epErr) {
        console.error('Failed to create EasyPaisa entry:', epErr);
      }

      if (customer && typeof customer.save === 'function') {
        customer.cart = [];
        try { await customer.save(); } catch (e) {}
      }

      const easyPaisaData = {
        superAdminNumber: easypaisaNumber,
        accountTitle,
        orderId: order._id.toString(),
        transactionAmount: totalAmount,
        itemsCount: orderItems.length
      };

      return res.json({ success: true, easyPaisaData, message: 'EasyPaisa Account Details' });
    }
    else {
      return res.status(400).json({ message: 'Invalid Payment Method' });
    }
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Checkout endpoints supporting single or multiple dynamic products
router.post('/', authenticateCustomer, handleCheckoutProcess);
router.post('/multiple', authenticateCustomer, handleCheckoutProcess);


// Endpoint to submit payment proof (EasyPaisa) - stays PENDING until Admin verifies
router.post('/confirm/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Do NOT auto-mark as PAID. Store the proof/reference and keep it PENDING
    // so the Shop Admin can manually verify and confirm the payment.
    if (req.body.transactionId) {
      order.transactionId = req.body.transactionId;
    }
    if (req.body.paymentProof) {
      order.paymentProof = req.body.paymentProof;
    }
    // paymentStatus stays 'PENDING' (default) until admin confirms
    await order.save();

    if (order.paymentMethod === 'EASYPAISA') {
      try {
        const ep = await EasyPaisa.findOne({ orderId: order._id || order.id });
        if (ep) {
          if (req.body.transactionId) ep.transactionId = req.body.transactionId;
          await ep.save();
        } else {
          await EasyPaisa.create({
            shopId: order.shopId,
            orderId: order._id || order.id,
            customerId: order.customerId,
            customerName: order.shippingDetails?.fullName || 'Customer',
            customerPhone: order.shippingDetails?.phone || '',
            transactionId: req.body.transactionId || '',
            senderNumber: order.shippingDetails?.phone || '',
            amount: order.totalAmount,
            status: order.paymentStatus || 'PENDING',
            items: order.items || []
          });
        }
      } catch (epSyncErr) {
        console.error('EasyPaisa confirm sync error:', epSyncErr);
      }
    }

    // Clear customer cart since the order has been placed
    const customer = await Customer.findById(order.customerId);
    if (customer) {
      customer.cart = [];
      await customer.save();
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Endpoint for a logged-in customer to view their own orders
router.get('/my-orders', authenticateCustomer, async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.customer._id })
      .sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

import { resolveShopId } from '../utils/shopResolver.js';

// Endpoint to fetch all orders for SuperAdmin / ShopAdmin inspection
router.get('/orders', authenticate, requireShopAdmin, async (req, res) => {
  try {
    const { shopId, paymentMethod, paymentStatus, orderStatus } = req.query;
    const query = {};

    // Shop Admins can only ever see their own shop's orders
    const targetRaw = (req.user?.role === 'shop_admin') ? req.user.shopId : shopId;
    if (targetRaw) {
      const resolved = await resolveShopId(targetRaw);
      if (resolved) {
        query.shopId = resolved;
      }
    }

    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (orderStatus) query.orderStatus = orderStatus;

    const orders = await Order.find(query)
      .populate('shopId', 'name address')
      .populate('customerId', 'fullName email phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Endpoint to fetch a single order (full order view)
router.get('/order/:orderId', authenticate, requireShopAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('shopId', 'name address')
      .populate('customerId', 'fullName email phone');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (req.user?.role === 'shop_admin' && String(order.shopId?._id) !== String(req.user?.shopId)) {
      return res.status(403).json({ message: 'Access denied for this order' });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Endpoint to update payment status or order status
router.patch('/order/:orderId/status', authenticate, requireShopAdmin, async (req, res) => {
  try {
    const { paymentStatus, orderStatus } = req.body;
    const order = await Order.findById(req.params.orderId).populate('customerId', 'fullName email');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (req.user?.role === 'shop_admin' && String(order.shopId) !== String(req.user?.shopId)) {
      return res.status(403).json({ message: 'Access denied for this order' });
    }

    const previousStatus = order.paymentStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (orderStatus) order.orderStatus = orderStatus;

    // When payment is approved (PAID) and was not PAID before:
    if (paymentStatus === 'PAID' && previousStatus !== 'PAID') {
      let totalProfit = 0;
      const saleItems = [];

      for (const item of (order.items || [])) {
        const prodId = item.itemId || item.productId;
        let dbItem = null;
        if (prodId) {
          try {
            dbItem = await Item.findById(prodId);
          } catch (e) { }
        }

        if (dbItem) {
          // Deduct stock safely based on quantity and unit
          const qty = Number(item.quantity) || 1;
          const unit = String(item.unit || 'egg').toLowerCase();
          const tPerPeti = Number(dbItem.traysPerPeti) || 12;
          const ePerTray = Number(dbItem.eggsPerTray) || 30;
          const ePerPeti = tPerPeti * ePerTray;
          const unitMultiplier = unit === 'peti' ? ePerPeti : unit === 'tray' ? ePerTray : 1;
          const totalEggs = qty * unitMultiplier;

          dbItem.stock = Math.max(0, (Number(dbItem.stock) || 0) - totalEggs);
          if (dbItem.unitType === 'peti') {
            dbItem.petiQuantity = Math.max(0, (Number(dbItem.petiQuantity) || 0) - (unit === 'peti' ? qty : (totalEggs / ePerPeti)));
          } else if (dbItem.unitType === 'tray') {
            dbItem.trayQuantity = Math.max(0, (Number(dbItem.trayQuantity) || 0) - (unit === 'tray' ? qty : (totalEggs / ePerTray)));
          } else if (dbItem.unitType === 'egg') {
            dbItem.eggQuantity = Math.max(0, (Number(dbItem.eggQuantity) || 0) - totalEggs);
          } else if ((dbItem.petiQuantity || 0) > 0) {
            dbItem.petiQuantity = Math.max(0, dbItem.petiQuantity - (unit === 'peti' ? qty : (totalEggs / ePerPeti)));
          }
          dbItem.lastUpdated = new Date().toISOString().split('T')[0];
          const updatedFields = {
            stock: dbItem.stock,
            petiQuantity: dbItem.petiQuantity,
            trayQuantity: dbItem.trayQuantity,
            eggQuantity: dbItem.eggQuantity,
            lastUpdated: dbItem.lastUpdated
          };
          if (typeof dbItem.save === 'function') {
            await dbItem.save();
          } else {
            await Item.findByIdAndUpdate(dbItem.id || dbItem._id, updatedFields);
          }

          try {
            const pIdVal = Number(dbItem.id || dbItem._id);
            if (pIdVal) {
              await pool.query(
                'UPDATE purchases SET petiQuantity = ?, trayQuantity = ?, eggQuantity = ? WHERE itemId = ?',
                [dbItem.petiQuantity, dbItem.trayQuantity, dbItem.stock, pIdVal]
              );
            }
          } catch (_) {}

          if (order.shopId) {
            try {
              const BranchModel = getBranchItemModel(order.shopId);
              await BranchModel.findByIdAndUpdate(dbItem._id, dbItem.toObject(), { upsert: true });
            } catch (branchErr) {
              console.warn('[Checkout BranchModel Sync Warning]:', branchErr.message);
            }
          }

          const costPrice = dbItem.costPrice || 0;
          const profit = (item.price - costPrice) * (item.quantity || 1);
          totalProfit += profit;

          saleItems.push({
            productId: dbItem._id,
            name: item.name || dbItem.name,
            quantity: item.quantity || 1,
            price: item.price,
            costPrice,
            subtotal: item.price * (item.quantity || 1),
            profit
          });
        } else {
          saleItems.push({
            productId: prodId || null,
            name: item.name || 'Product',
            quantity: item.quantity || 1,
            price: item.price || 0,
            subtotal: (item.price || 0) * (item.quantity || 1),
            profit: 0
          });
        }
      }

      const existingSale = await Sale.findOne({ orderId: order._id });
      if (existingSale) {
        existingSale.approvalStatus = 'APPROVED';
        existingSale.status = 'completed';
        if (totalProfit) existingSale.totalProfit = totalProfit;
        await existingSale.save();
      } else {
        await Sale.create({
          shopId: order.shopId,
          orderId: order._id || order.id,
          customerId: order.customerId?._id || order.customerId?.id || order.customerId,
          items: saleItems,
          totalAmount: order.totalAmount,
          totalProfit,
          saleDate: order.createdAt || new Date(),
          status: 'completed',
          cashierName: req.user?.fullName || 'Online Storefront',
          customerName: order.customerId?.fullName || order.shippingDetails?.fullName || 'Online Customer',
          customerEmail: order.customerId?.email || order.shippingDetails?.email || '',
          customerPhone: order.customerId?.phone || order.shippingDetails?.phone || '',
          paymentMethod: order.paymentMethod === 'COD' ? 'CASH' : (order.paymentMethod === 'STRIPE' ? 'ONLINE' : 'BANK_TRANSFER'),
          cashPaid: order.paymentMethod === 'COD' ? order.totalAmount : 0,
          bankPaid: order.paymentMethod !== 'COD' ? order.totalAmount : 0,
          dueAmount: 0,
          isOnlineOrder: true,
          orderSource: 'ONLINE_STOREFRONT',
          approvalStatus: 'APPROVED'
        });
      }
    }

    // Synchronize EasyPaisa table
    if (order.paymentMethod === 'EASYPAISA' && paymentStatus) {
      try {
        const ep = await EasyPaisa.findOne({ orderId: order._id || order.id });
        if (ep) {
          ep.status = paymentStatus;
          await ep.save();
        }
      } catch (epStatusErr) {
        console.error('Failed to sync EasyPaisa status:', epStatusErr);
      }
    }

    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Endpoint to delete payment proof screenshot of an order
router.delete('/order/:orderId/proof', authenticate, requireShopAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (req.user?.role === 'shop_admin' && String(order.shopId) !== String(req.user?.shopId)) {
      return res.status(403).json({ message: 'Access denied for this order' });
    }

    order.paymentProof = null;
    await order.save();
    res.json({ success: true, message: 'Payment screenshot proof deleted successfully', order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Endpoint to delete an order completely
router.delete('/order/:orderId', authenticate, requireShopAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (req.user?.role === 'shop_admin' && String(order.shopId) !== String(req.user?.shopId)) {
      return res.status(403).json({ message: 'Access denied for this order' });
    }

    await Order.findByIdAndDelete(req.params.orderId);
    try {
      await EasyPaisa.deleteMany({ orderId: req.params.orderId });
    } catch (_) {}

    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

