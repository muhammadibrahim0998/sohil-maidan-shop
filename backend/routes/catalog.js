import express from 'express';
import Item, { getBranchItemModel, syncBranchProducts } from '../models/Item.js';
import Settings from '../models/Settings.js';
import Shop from '../models/Shop.js';
import { resolveShopId } from '../utils/shopResolver.js';

const router = express.Router();

const DEFAULT_EGG_PRODUCTS = [
  { name: 'loman brown',       category: 'loman brown',       price: 25, stock: 500, costPrice: 20 },
  { name: 'china egge',        category: 'china egge',        price: 20, stock: 600, costPrice: 15 },
  { name: 'loman brown egge',  category: 'loman brown egge',  price: 26, stock: 500, costPrice: 21 },
  { name: 'loman black',       category: 'loman black',       price: 28, stock: 400, costPrice: 22 },
  { name: 'china eggs',        category: 'china eggs',        price: 20, stock: 600, costPrice: 15 },
  { name: 'pak egg',           category: 'pak egg',           price: 22, stock: 600, costPrice: 17 },
  { name: 'Super Jumbo',       category: 'Super Jumbo',       price: 30, stock: 500, costPrice: 24 },
  { name: 'Jumbo',             category: 'Jumbo',             price: 28, stock: 500, costPrice: 22 },
  { name: 'Stander',           category: 'Stander',           price: 25, stock: 500, costPrice: 20 },
  { name: 'Weak Shell',        category: 'Weak Shell',        price: 18, stock: 300, costPrice: 14 },
  { name: 'Dusty',             category: 'Dusty',             price: 16, stock: 300, costPrice: 12 },
  { name: 'Floor',             category: 'Floor',             price: 15, stock: 200, costPrice: 11 },
  { name: 'Step Stander',      category: 'Step Stander',      price: 22, stock: 400, costPrice: 17 },
  { name: 'Step Jumbo',        category: 'Step Jumbo',        price: 24, stock: 400, costPrice: 19 },
  { name: 'Sandy',             category: 'Sandy',             price: 15, stock: 200, costPrice: 11 },
  { name: 'Starter',           category: 'Starter',           price: 20, stock: 400, costPrice: 15 },
  { name: 'Double White',      category: 'Double White',      price: 32, stock: 200, costPrice: 25 },
  { name: 'Double Brown',      category: 'Double Brown',      price: 35, stock: 200, costPrice: 28 },
  { name: 'Golden',            category: 'Golden',            price: 40, stock: 150, costPrice: 32 },
  { name: 'Breeder',           category: 'Breeder',           price: 45, stock: 150, costPrice: 36 },
  { name: 'Special',           category: 'Special',           price: 50, stock: 150, costPrice: 40 }
];

const ALL_DEFAULT_BRANCH_PAGES = [
  'dashboard', 'store', 'walkin', 'sales', 'purchases', 'vendors',
  'vendorDirectory', 'customerPaymentLedger', 'vendorPaymentLedger',
  'expenses', 'team', 'reports', 'settings'
];

export const ALL_OPERATION_KEYS = [
  'sales_edit', 'sales_delete',
  'purchases_edit', 'purchases_delete',
  'customerPaymentLedger_edit', 'customerPaymentLedger_delete',
  'vendors_edit', 'vendors_delete',
  'expenses_edit', 'expenses_delete',
  'damaged_edit', 'damaged_delete'
];

// GET /api/catalog/:shopId  — public, no auth needed
router.get('/:shopId', async (req, res) => {
  try {
    const { shopId } = req.params;
    const { search, category } = req.query;

    const resolvedId = await resolveShopId(shopId);
    const shop = await Shop.findById(resolvedId).select('name address contactNumber status logoUrl bankName bankAccountNumber bankAccountTitle easypaisaNumber isEditApproved isDeleteApproved approvalStatus approvalNotes allowedPages');
    if (!shop || shop.status !== 'active') {
      return res.status(404).json({ message: 'Shop not found or inactive' });
    }

    const realShopId = shop._id;
    const settings = await Settings.findOne({ shopId: realShopId }).select('shopName logoUrl currency address phone bankName bankAccountNumber bankAccountTitle easypaisaNumber');
    const BranchModel = getBranchItemModel(realShopId);

    const filter = { shopId: realShopId };
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    if (category && category !== 'All') {
      filter.category = category;
    }

    let rawItems = await BranchModel.find(filter).sort({ name: 1 });
    if (rawItems.length === 0) {
      // Sync from main Item collection if branch collection is temporarily empty
      await syncBranchProducts(realShopId);
      rawItems = await BranchModel.find(filter).sort({ name: 1 });
    }
    const items = rawItems.map(item => {
      const itemObj = typeof item.toObject === 'function' ? item.toObject() : item;
      const pMethod = String(itemObj.paymentMethod || '').trim().toLowerCase();
      const isOnline = itemObj.isOnlinePayment === true || Boolean(itemObj.paymentReceipt) || (
        pMethod.includes('bank') || pMethod.includes('easy') || pMethod.includes('jazz') || pMethod.includes('online') || pMethod.includes('cheque') || pMethod.includes('transfer') || pMethod.includes('card')
      );
      itemObj.isOnlinePayment = isOnline;

      const petiQty = Number(itemObj.petiQuantity) || 0;
      const stock = Number(itemObj.stock) || 0;
      const unitCost = Number(itemObj.costPrice) > 0 ? Number(itemObj.costPrice) : Number(itemObj.price || 0);
      const unitDivisor = itemObj.unitType === 'egg' ? 1 : itemObj.unitType === 'tray' ? 30 : 360;

      const calculatedCost = Number(itemObj.totalPurchaseCost) > 0
        ? Number(itemObj.totalPurchaseCost)
        : (petiQty > 0 ? petiQty * unitCost : (stock > 0 ? stock * (unitCost / unitDivisor) : 0));
      
      itemObj.totalPurchaseCost = Math.round(calculatedCost);

      const isCreditMethod = pMethod.includes('credit') || pMethod.includes('due') || pMethod.includes('partial');
      const hasExplicitDue = itemObj.dueAmountToSupplier !== undefined && itemObj.dueAmountToSupplier !== null && Number(itemObj.dueAmountToSupplier) > 0;

      if (hasExplicitDue || isCreditMethod) {
        const rawDue = hasExplicitDue ? Number(itemObj.dueAmountToSupplier) : itemObj.totalPurchaseCost;
        itemObj.dueAmountToSupplier = Math.min(itemObj.totalPurchaseCost, Math.max(0, rawDue));
        itemObj.amountPaidToSupplier = Math.max(0, itemObj.totalPurchaseCost - itemObj.dueAmountToSupplier);
      } else {
        // 100% Cash / Bank Paid (No Credit)
        itemObj.amountPaidToSupplier = itemObj.totalPurchaseCost;
        itemObj.dueAmountToSupplier = 0;
      }

      return itemObj;
    });

    // Get unique categories from real products only
    const allItems = await Item.find({ shopId: realShopId }).select('category');
    const existingCats = allItems.map(i => i.category).filter(Boolean);
    const categories = ['All', ...new Set(existingCats)];

    const isLocked = shop.approvalStatus === 'LOCKED';
    const safeAllowedPages = (() => {
      let pages = shop.allowedPages;
      if (typeof pages === 'string') {
        try { pages = JSON.parse(pages); } catch { pages = null; }
      }
      if (isLocked) {
        return [];
      }
      if (Array.isArray(pages)) {
        return pages;
      }
      return (Number(shop.isEditApproved) === 0 && Number(shop.isDeleteApproved) === 0)
        ? []
        : [...ALL_DEFAULT_BRANCH_PAGES, ...ALL_OPERATION_KEYS];
    })();

    res.json({
      shop: {
        _id: realShopId,
        id: realShopId,
        name: settings?.shopName || shop.name,
        address: settings?.address || shop.address,
        phone: settings?.phone || shop.contactNumber,
        logoUrl: settings?.logoUrl || shop.logoUrl,
        currency: (!settings?.currency || settings.currency === '$') ? 'Rs.' : settings.currency,
        bankName: settings?.bankName || shop.bankName || '',
        bankAccountNumber: settings?.bankAccountNumber || shop.bankAccountNumber || '',
        bankAccountTitle: settings?.bankAccountTitle || shop.bankAccountTitle || '',
        easypaisaNumber: settings?.easypaisaNumber || shop.easypaisaNumber || '',
        isEditApproved: isLocked ? 0 : ((shop.isEditApproved !== undefined && shop.isEditApproved !== null) ? (shop.isEditApproved ? 1 : 0) : 1),
        isDeleteApproved: isLocked ? 0 : ((shop.isDeleteApproved !== undefined && shop.isDeleteApproved !== null) ? (shop.isDeleteApproved ? 1 : 0) : 1),
        approvalStatus: shop.approvalStatus || 'APPROVED',
        approvalNotes: shop.approvalNotes || '',
        allowedPages: safeAllowedPages
      },
      items,
      categories
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/catalog  — list all active shops (for multi-shop entry)
router.get('/', async (req, res) => {
  try {
    const shops = await Shop.find({ status: 'active' }).select('name address contactNumber logoUrl bankName bankAccountNumber bankAccountTitle easypaisaNumber isEditApproved isDeleteApproved approvalStatus approvalNotes allowedPages');
    const safeShops = shops.map(s => {
      const raw = typeof s.toObject === 'function' ? s.toObject() : { ...s };
      const branchLocked = raw.approvalStatus === 'LOCKED';
      let pages = raw.allowedPages;
      if (typeof pages === 'string') {
        try { pages = JSON.parse(pages); } catch { pages = null; }
      }
      if (branchLocked) {
        raw.allowedPages = [];
        raw.isEditApproved = 0;
        raw.isDeleteApproved = 0;
      } else if (Array.isArray(pages)) {
        raw.allowedPages = pages;
        raw.isEditApproved = raw.isEditApproved !== undefined ? (raw.isEditApproved ? 1 : 0) : 1;
        raw.isDeleteApproved = raw.isDeleteApproved !== undefined ? (raw.isDeleteApproved ? 1 : 0) : 1;
      } else {
        const noneApproved = Number(raw.isEditApproved) === 0 && Number(raw.isDeleteApproved) === 0;
        raw.allowedPages = noneApproved ? [] : [...ALL_DEFAULT_BRANCH_PAGES, ...ALL_OPERATION_KEYS];
        raw.isEditApproved = noneApproved ? 0 : 1;
        raw.isDeleteApproved = noneApproved ? 0 : 1;
      }
      return raw;
    });
    res.json(safeShops);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
