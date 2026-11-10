import express from 'express';
const router = express.Router();
import Sale from '../models/Sale.js';
import Order from '../models/Order.js';
import Item, { getBranchItemModel } from '../models/Item.js';
import Purchase from '../models/Purchase.js';
import CashSession from '../models/CashSession.js';
import Customer from '../models/Customer.js';
import CustomerCredit from '../models/CustomerCredit.js';
import CustomerPaymentLedger from '../models/CustomerPaymentLedger.js';
import VendorPaymentLedger from '../models/VendorPaymentLedger.js';
import PurchaseCredit from '../models/PurchaseCredit.js';
import { generateInvoice } from '../utils/generateInvoice.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import Settings from '../models/Settings.js';
import Shop from '../models/Shop.js';
import { authenticate, requireShopAdmin, preventSuperAdmin } from '../middleware/auth.js';
import { resolveShopId } from '../utils/shopResolver.js';
import pool from '../config/mysql.js';
import { BRANCH_TABLE_PREFIXES } from '../models/dbHelper.js';

// Helper to dynamically hydrate items on any sale record (online & local branches)
const hydrateSaleItems = async (s, branchPrefix = 'peshawar_branch') => {
  if (!s) return s;

  let items = [];
  if (Array.isArray(s.items)) {
    items = s.items;
  } else if (typeof s.items === 'string' && s.items.trim()) {
    try {
      items = JSON.parse(s.items);
      if (typeof items === 'string') items = JSON.parse(items);
    } catch (_) { items = []; }
  }
  if (!Array.isArray(items)) items = [];

  // 1. If items is empty, try querying sale_items table
  if (items.length === 0 && (s.id || s._id)) {
    const saleId = s.id || s._id;
    try {
      let [rows] = await pool.query(
        `SELECT * FROM \`${branchPrefix}__sale_items\` WHERE saleId = ?`,
        [saleId]
      ).catch(() => [[]]);

      if (!rows || rows.length === 0) {
        [rows] = await pool.query(
          `SELECT * FROM \`sale_items\` WHERE saleId = ?`,
          [saleId]
        ).catch(() => [[]]);
      }

      if (rows && rows.length > 0) {
        items = rows.map(r => {
          const qty = Number(r.quantity) || 1;
          const rawUnit = (r.unit || r.unitType || 'peti').toLowerCase();
          const unit = rawUnit.includes('peti') ? 'peti' : (rawUnit.includes('tray') ? 'tray' : 'egg');
          const unitLabel = unit === 'peti' ? 'Peti' : (unit === 'tray' ? 'Tray' : 'Egg');
          const tEggs = Number(r.totalEggs) > 0 ? Number(r.totalEggs) : (unit === 'peti' ? qty * 360 : (unit === 'tray' ? qty * 30 : qty));
          const name = r.name || 'Eggs';
          return {
            productId: r.productId,
            name,
            rawProductName: name,
            quantity: qty,
            unit,
            unitLabel,
            totalEggs: tEggs,
            price: Number(r.price) || 0,
            costPrice: Number(r.costPrice) || 0,
            subtotal: Number(r.subtotal) || 0,
            profit: Number(r.profit) || 0
          };
        });
      }
    } catch (_) {}
  }

  // 2. If items is still empty, look up in customer_payment_ledger
  if (items.length === 0 && (s.id || s.invoiceNumber)) {
    try {
      let [cplRows] = await pool.query(
        `SELECT * FROM \`${branchPrefix}__customer_payment_ledger\` WHERE saleId = ? OR invoiceNumber = ? LIMIT 1`,
        [String(s.id || s._id), String(s.invoiceNumber || '')]
      ).catch(() => [[]]);

      if (!cplRows || cplRows.length === 0) {
        [cplRows] = await pool.query(
          `SELECT * FROM \`customer_payment_ledger\` WHERE saleId = ? OR invoiceNumber = ? LIMIT 1`,
          [String(s.id || s._id), String(s.invoiceNumber || '')]
        ).catch(() => [[]]);
      }

      if (cplRows && cplRows.length > 0) {
        const c = cplRows[0];
        if (c.items) {
          try {
            const parsed = typeof c.items === 'string' ? JSON.parse(c.items) : c.items;
            if (Array.isArray(parsed) && parsed.length > 0) items = parsed;
          } catch (_) {}
        }
        if (items.length === 0 && c.itemsDescription) {
          s.itemsDescription = c.itemsDescription;
        }
        if (!s.petisBought && Number(c.petisBought) > 0) s.petisBought = Number(c.petisBought);
        if (!s.eggsBought && Number(c.eggsBought) > 0) s.eggsBought = Number(c.eggsBought);
      }
    } catch (_) {}
  }

  // 3. Parse items from itemsDescription (e.g. "egg x4 Peti", "Golden (4 peti)", "Breeder (1 Peti)", "egg (10 peti)")
  if (items.length === 0 && s.itemsDescription && typeof s.itemsDescription === 'string') {
    const parts = s.itemsDescription.split(',').map(p => p.trim()).filter(Boolean);
    parts.forEach(part => {
      const match = part.match(/^([^(x]+?)(?:\s*(?:x|\()\s*([\d\.]+)\s*([a-zA-Z]+))?/i);
      if (match) {
        const rawName = (match[1] || 'Eggs').trim();
        const cleanName = rawName.replace(/\s*\(.*?\)/g, '').trim() || 'Eggs';
        const qty = Number(match[2]) || (Number(s.petisBought) > 0 ? Number(s.petisBought) : 1);
        const rawUnit = (match[3] || 'Peti').toLowerCase();
        const unit = rawUnit.includes('peti') ? 'peti' : (rawUnit.includes('tray') ? 'tray' : 'egg');
        const unitLabel = unit === 'peti' ? 'Peti' : (unit === 'tray' ? 'Tray' : 'Egg');
        const tEggs = unit === 'peti' ? qty * 360 : (unit === 'tray' ? qty * 30 : qty);
        items.push({
          name: cleanName,
          rawProductName: cleanName,
          quantity: qty,
          unit,
          unitLabel,
          totalEggs: tEggs,
          subtotal: Number(s.totalAmount) || 0
        });
      }
    });
  }

  // 4. Construct from petisBought / eggsBought / category
  if (items.length === 0) {
    const pBought = Number(s.petisBought) || 0;
    const eBought = Number(s.eggsBought) || 0;
    const totAmt = Number(s.totalAmount) || 0;
    const prodName = s.category || 'Eggs';

    if (pBought > 0) {
      items.push({
        name: prodName,
        rawProductName: prodName,
        quantity: pBought,
        unit: 'peti',
        unitLabel: 'Peti',
        totalEggs: pBought * 360,
        subtotal: totAmt
      });
    } else if (eBought > 0) {
      const petisFromEggs = Number((eBought / 360).toFixed(1));
      items.push({
        name: prodName,
        rawProductName: prodName,
        quantity: petisFromEggs >= 1 ? petisFromEggs : eBought,
        unit: petisFromEggs >= 1 ? 'peti' : 'egg',
        unitLabel: petisFromEggs >= 1 ? 'Peti' : 'Egg',
        totalEggs: eBought,
        subtotal: totAmt
      });
    } else if (totAmt > 0) {
      const calcPetis = Math.max(1, Number((totAmt / 1050).toFixed(1)));
      items.push({
        name: prodName,
        rawProductName: prodName,
        quantity: calcPetis,
        unit: 'peti',
        unitLabel: 'Peti',
        totalEggs: Math.round(calcPetis * 360),
        subtotal: totAmt
      });
    }
  }

  // 5. Standardize every item object
  s.items = items.map(it => {
    const q = Number(it.quantity) || 1;
    const rawU = String(it.unitLabel || it.unit || 'peti').toLowerCase().trim();
    const u = rawU.includes('peti') ? 'peti' : (rawU.includes('tray') ? 'tray' : 'egg');
    const uLabel = u === 'peti' ? 'Peti' : (u === 'tray' ? 'Tray' : 'Egg');
    let tEggs = Number(it.totalEggs);
    if (!tEggs || isNaN(tEggs)) {
      tEggs = u === 'peti' ? q * 360 : (u === 'tray' ? q * 30 : q);
    }
    const cleanName = (it.rawProductName || it.name || it.title || 'Eggs').replace(/\s*\(.*?\)/g, '').trim() || 'Eggs';
    return {
      ...it,
      name: cleanName,
      rawProductName: cleanName,
      quantity: q,
      unit: u,
      unitLabel: uLabel,
      totalEggs: tEggs
    };
  });

  return s;
};

// Helper to check Super Admin approval for branch edit/delete/page permission
const checkBranchApproval = async (req, actionType = 'edit', requiredPage = 'sales') => {
  if (req.user?.role === 'super_admin' || req.headers['x-user-role'] === 'super_admin') return true;
  const rawShopId = req.user?.shopId || req.headers['x-shop-id'] || req.query?.shopId || req.body?.shopId || req.params?.shopId || 1;
  const sId = await resolveShopId(rawShopId);
  if (!sId) return true;
  try {
    const targetShop = await Shop.findById(sId);
    if (!targetShop) return true;
    if (targetShop.approvalStatus === 'LOCKED') return false;

    let allowed = targetShop.allowedPages;
    if (typeof allowed === 'string') {
      try { allowed = JSON.parse(allowed); } catch { allowed = []; }
    }
    if (Array.isArray(allowed)) {
      const hasGranularOps = allowed.some(k => typeof k === 'string' && (k.endsWith('_edit') || k.endsWith('_delete')));
      if (hasGranularOps) {
        const opKey = `${requiredPage}_${actionType}`;
        return allowed.includes(opKey);
      }
    }

    if (actionType === 'edit' && Number(targetShop.isEditApproved) === 0) return false;
    if (actionType === 'delete' && Number(targetShop.isDeleteApproved) === 0) return false;
    return true;
  } catch (err) {
    return true;
  }
};

// Helper to verify Owner Password (Anti-Theft)
// We now use `authenticate` and `requireShopAdmin` standard RBAC for powerful actions
// If you want to keep the literal pin-based password logic, you can combine them, but for Multi-Tenant RBAC
// checking user roles (requireShopAdmin) is standard. We'll leave the password check wrapped over the new system to preserve feature parity.
const verifyOwnerPassword = async (req, res, next) => {
  try {
    const password = req.headers['x-owner-password'];
    
    // Bypass if user is super admin or shop admin from token
    if (req.user && ['super_admin', 'shop_admin'].includes(req.user.role)) return next();

    let settings = await Settings.findOne({ shopId: req.user.shopId });
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    const correctPassword = settings.ownerPassword;
    
    if (password !== correctPassword) {
      return res.status(403).json({ message: "Owner authorization required for this action." });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: "Auth check failed" });
  }
};

// ── Super Admin: Get ALL sales across all shops ──────────────────────
router.get('/all', authenticate, async (req, res) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ message: 'Super Admin only.' });
  }
  try {
    const sales = await Sale.find({}).sort({ saleDate: -1 });
    const hydratedSales = await Promise.all((sales || []).map(s => {
      const pfx = (s && s.shopId && BRANCH_TABLE_PREFIXES[s.shopId]) || 'peshawar_branch';
      return hydrateSaleItems(s, pfx);
    }));
    res.json(hydratedSales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Payment Ledger & Financial Flow Endpoint (Dynamic for Branches & Super Admin) ──
router.get('/payment-ledger', authenticate, async (req, res) => {
  try {
    const rawShopId = req.query.shopId || (req.user?.role !== 'super_admin' ? (req.user?.shopId?._id || req.user?.shopId) : null);
    let targetShopId = null;
    if (rawShopId && rawShopId !== 'ALL' && rawShopId !== 'all') {
      targetShopId = await resolveShopId(rawShopId) || rawShopId;
    }

    const filter = targetShopId ? { shopId: targetShopId } : {};

    // 1. Fetch Sales from dynamic CustomerPaymentLedger branch table and Sale table
    let salesList = [];
    try {
      let custLedgerRows = [];
      let rawSales = [];

      try {
        custLedgerRows = await CustomerPaymentLedger.find(filter).sort({ date: -1, createdAt: -1 });
      } catch (cplErr) {
        console.warn('CustomerPaymentLedger.find notice:', cplErr.message);
      }

      try {
        rawSales = await Sale.find(filter).sort({ saleDate: -1, createdAt: -1 });
      } catch (sErr) {
        console.warn('Sale.find notice:', sErr.message);
      }

      const salesMap = new Map();
      (rawSales || []).forEach(s => {
        const sId = String(s.id || s._id || '');
        const invNo = String(s.invoiceNumber || '').trim();
        if (sId) salesMap.set(sId, s);
        if (invNo) salesMap.set(invNo, s);
      });

      const seenSaleIds = new Set();

      if (custLedgerRows && custLedgerRows.length > 0) {
        custLedgerRows.forEach(c => {
          const total = Number(c.totalAmount) || 0;
          let cash = Number(c.cashPaid) || 0;
          let bank = Number(c.bankPaid) || 0;
          let due = Number(c.dueAmount) || 0;
          const pMethod = String(c.paymentMethod || 'CASH').toUpperCase();

          if (cash === 0 && bank === 0 && due === 0) {
            if (pMethod === 'CASH') cash = total;
            else if (pMethod.includes('BANK') || pMethod.includes('ONLINE') || pMethod.includes('EASYPAISA')) bank = total;
            else if (pMethod.includes('CREDIT') || pMethod.includes('DUE')) due = total;
            else cash = total;
          }

          const sKey = String(c.saleId || c.invoiceNumber || c.id);
          seenSaleIds.add(String(c.saleId || ''));
          seenSaleIds.add(String(c.invoiceNumber || '').trim());
          if (c.id) seenSaleIds.add(String(c.id));

          const matchingSale = salesMap.get(String(c.saleId || '')) || salesMap.get(String(c.invoiceNumber || '').trim());
          let items = [];
          if (matchingSale && matchingSale.items) {
            items = typeof matchingSale.items === 'string' ? JSON.parse(matchingSale.items) : matchingSale.items;
          } else if (c.items) {
            items = typeof c.items === 'string' ? JSON.parse(c.items) : c.items;
          }
          if (!Array.isArray(items)) items = [];

          let totalPetis = Number(c.petisBought) || 0;
          let totalEggs = Number(c.eggsBought) || 0;

          if (items.length > 0) {
            let petisCount = 0;
            let eggsCount = 0;
            items.forEach(it => {
              const qty = Number(it.quantity) || 1;
              const u = (it.unitLabel || it.unit || '').toLowerCase();
              if (u.includes('peti')) { petisCount += qty; eggsCount += qty * 360; }
              else if (u.includes('tray')) { petisCount += qty / 12; eggsCount += qty * 30; }
              else { eggsCount += qty; petisCount += qty / 360; }
            });
            if (totalPetis === 0) totalPetis = petisCount;
            if (totalEggs === 0) totalEggs = eggsCount;
          } else if (totalPetis === 0 && totalEggs === 0 && total > 0) {
            // Dynamic fallback estimate so it NEVER shows 0 eggs / 0 petis
            totalPetis = Number((total / 1050).toFixed(2)) || 1;
            totalEggs = Math.round(totalPetis * 360);
          }

          let itemsDesc = c.itemsDescription;
          if ((!itemsDesc || itemsDesc === 'Eggs Stock') && items && items.length > 0) {
            itemsDesc = items.map(i => `${i.rawProductName || i.name || 'Eggs'} (${i.quantity || 1} ${i.unitLabel || i.unit || 'x'})`).join(', ');
          }
          if (!itemsDesc) itemsDesc = 'Eggs Stock';

          salesList.push({
            id: c.id,
            shopId: c.shopId,
            saleId: c.saleId,
            date: c.date || c.createdAt,
            invoiceNumber: c.invoiceNumber || `INV-${String(c.saleId || c.id).slice(-5)}`,
            customerName: c.customerName || (due > 0 ? 'Credit Customer' : 'Walk-in Customer'),
            customerPhone: c.customerPhone || '',
            customerEmail: matchingSale?.customerEmail || '',
            totalAmount: total,
            cashPaid: cash,
            bankPaid: bank,
            dueAmount: due,
            paymentMethod: pMethod,
            petisBought: totalPetis > 0 ? Number(totalPetis.toFixed(2)) : 0,
            eggsBought: Math.round(totalEggs),
            itemsDescription: itemsDesc,
            items: items || [],
            category: c.category || (items[0]?.category) || 'Eggs',
            status: c.status || (due === 0 ? 'PAID' : (cash > 0 || bank > 0 ? 'PARTIAL' : 'CREDIT'))
          });
        });
      }

      // Merge any sales from Sale.find that are not already in CustomerPaymentLedger
      (rawSales || [])
        .filter(s => s && s.status !== 'cancelled')
        .forEach(s => {
          const sid = String(s.id || s._id || '');
          const inv = String(s.invoiceNumber || '').trim();
          if ((sid && seenSaleIds.has(sid)) || (inv && seenSaleIds.has(inv))) {
            return; // Already present from custLedgerRows
          }

          const total = Number(s.totalAmount) || 0;
          let cash = Number(s.cashPaid) || 0;
          let bank = Number(s.bankPaid) || 0;
          let due = Number(s.dueAmount) || 0;
          const pMethod = String(s.paymentMethod || 'CASH').toUpperCase();

          if (cash === 0 && bank === 0 && due === 0) {
            if (pMethod === 'CASH') cash = total;
            else if (pMethod.includes('BANK') || pMethod.includes('ONLINE') || pMethod.includes('EASYPAISA')) bank = total;
            else if (pMethod.includes('CREDIT') || pMethod.includes('DUE')) due = total;
            else cash = total;
          }

          let saleItems = [];
          if (Array.isArray(s.items)) {
            saleItems = s.items;
          } else if (typeof s.items === 'string' && s.items.trim()) {
            try { saleItems = JSON.parse(s.items); if (typeof saleItems === 'string') saleItems = JSON.parse(saleItems); } catch { saleItems = []; }
          }
          if (!Array.isArray(saleItems)) saleItems = [];

          let totalPetis = Number(s.petisBought) || 0;
          let totalEggs = Number(s.eggsBought) || 0;
          let itemsDescriptions = [];

          if (saleItems.length > 0) {
            saleItems.forEach(it => {
              const qty = Number(it.quantity) || 1;
              const uType = (it.unit || it.unitType || it.unitLabel || 'peti').toLowerCase();
              let petiCount = 0;
              let eggCount = 0;

              if (uType.includes('peti')) {
                petiCount = qty;
                eggCount = qty * 360;
              } else if (uType.includes('tray')) {
                petiCount = qty / 12;
                eggCount = qty * 30;
              } else {
                petiCount = qty / 360;
                eggCount = qty;
              }

              if (Number(it.petiQuantity) > 0) petiCount = Number(it.petiQuantity);
              if (Number(it.totalEggs) > 0) eggCount = Number(it.totalEggs);

              totalPetis += petiCount;
              totalEggs += eggCount;
              itemsDescriptions.push(`${it.name || it.rawProductName || 'Eggs'} (${qty} ${uType})`);
            });
          } else if (totalPetis === 0 && totalEggs === 0 && total > 0) {
            totalPetis = Number((total / 1050).toFixed(2)) || 1;
            totalEggs = Math.round(totalPetis * 360);
          }

          salesList.push({
            id: s._id || s.id,
            shopId: s.shopId,
            date: s.saleDate || s.createdAt,
            invoiceNumber: s.invoiceNumber || `INV-${String(s.serialNumber || s.id).slice(-5)}`,
            customerName: s.customerName || (due > 0 ? 'Credit Customer' : 'Walk-in Customer'),
            customerPhone: s.customerPhone || '',
            customerEmail: s.customerEmail || '',
            totalAmount: total,
            cashPaid: cash,
            bankPaid: bank,
            dueAmount: due,
            paymentMethod: pMethod,
            petisBought: totalPetis > 0 ? Number(totalPetis.toFixed(2)) : 0,
            eggsBought: Math.round(totalEggs),
            itemsDescription: itemsDescriptions.join(', ') || s.itemsDescription || 'Eggs Stock',
            items: saleItems,
            category: (saleItems.length > 0 && saleItems[0]?.category) || s.category || 'Eggs',
            status: due === 0 ? 'PAID' : (cash > 0 || bank > 0 ? 'PARTIAL' : 'CREDIT')
          });
        });
    } catch (e) {
      console.warn('CustomerPaymentLedger fetch warning:', e.message);
    }

    // 2. Fetch Purchases from dynamic VendorPaymentLedger branch table
    let purchasesList = [];
    try {
      const vndLedgerRows = await VendorPaymentLedger.find(filter).sort({ date: -1, createdAt: -1 });
      if (vndLedgerRows && vndLedgerRows.length > 0) {
        purchasesList = vndLedgerRows.map(p => {
          const totalCost = Number(p.totalCost) || 0;
          const dueAmt = Number(p.dueAmount) || 0;
          let paidAmt = Number(p.amountPaid) || 0;
          if (paidAmt === 0 && totalCost > 0 && dueAmt < totalCost) {
            paidAmt = totalCost - dueAmt;
          }
          let cashAmt = Number(p.cashPaid) || 0;
          let bankAmt = Number(p.bankPaid) || 0;
          const pMethod = String(p.paymentMethod || (dueAmt > 0 && paidAmt === 0 ? 'Credit' : 'Cash')).toUpperCase();

          if (cashAmt === 0 && bankAmt === 0 && paidAmt > 0) {
            if (pMethod.includes('BANK') || pMethod.includes('ONLINE') || pMethod.includes('TRANSFER') || pMethod.includes('EASYPAISA')) {
              bankAmt = paidAmt;
            } else if (pMethod.includes('SPLIT')) {
              cashAmt = Math.floor(paidAmt / 2);
              bankAmt = paidAmt - cashAmt;
            } else {
              cashAmt = paidAmt;
            }
          }

          const petisVal = Number(p.petisPurchased || p.petiQuantity || p.petisCount || 0);
          const traysVal = Number(p.trayQuantity || p.traysCount || (petisVal > 0 ? Math.round(petisVal * 12) : 0));
          const eggsVal = Number(p.eggQuantity || p.totalEggsCount || (petisVal > 0 ? Math.round(petisVal * 360) : 0));

          return {
            id: p.id,
            shopId: p.shopId,
            purchaseId: p.purchaseId,
            date: p.date || p.createdAt,
            createdAt: p.createdAt || p.date,
            supplierName: p.supplierName || 'Farm Vendor',
            supplierPhone: p.supplierPhone || '',
            supplierLocation: p.supplierLocation || '',
            productName: p.productName || 'Eggs Stock',
            category: p.category || 'Eggs',
            petisPurchased: petisVal,
            petiQuantity: petisVal,
            petisCount: petisVal,
            trayQuantity: traysVal,
            traysCount: traysVal,
            eggQuantity: eggsVal,
            totalEggsCount: eggsVal,
            quantityText: p.quantityText || '',
            unitType: p.unitType || 'peti',
            buyCost: Number(p.buyCost) || 0,
            totalCost: Math.round(totalCost),
            amountPaid: Math.round(paidAmt),
            cashPaid: Math.round(cashAmt),
            bankPaid: Math.round(bankAmt),
            dueAmount: Math.round(dueAmt),
            paymentMethod: pMethod,
            status: p.status || (dueAmt === 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : 'CREDIT'))
          };
        });
      }
    } catch (e) {
      console.warn('VendorPaymentLedger fetch warning:', e.message);
    }

    // Fallback to Purchase.find and Item.find if branch table is empty
    if (purchasesList.length === 0) {
      let rawPurchases = [];
      let rawItems = [];
      try {
        rawPurchases = await Purchase.find(filter).sort({ purchaseDate: -1, createdAt: -1 });
      } catch (pErr) {
        console.warn('Purchase.find notice:', pErr.message);
      }
      try {
        rawItems = await Item.find(filter).sort({ createdAt: -1 });
      } catch (iErr) {
        console.warn('Item.find notice:', iErr.message);
      }

      const itemMap = new Map();
      (rawItems || []).forEach(it => {
        const itId = it.id || it._id;
        if (itId) itemMap.set(String(itId), it);
      });

      const seenItemIds = new Set();

      (rawPurchases || []).forEach(p => {
        const pId = p.id || p._id;
        const itId = p.itemId ? String(p.itemId) : null;
        if (itId) seenItemIds.add(itId);

        const matchingItem = itId ? itemMap.get(itId) : null;

        const totalCost = Number(p.totalCost) || (Number(matchingItem?.totalPurchaseCost) || 0);
        let dueAmt = Number(p.dueAmount);
        if (isNaN(dueAmt) || dueAmt < 0) {
          dueAmt = matchingItem?.dueAmountToSupplier !== undefined ? Number(matchingItem.dueAmountToSupplier) : 0;
        }

        let paidAmt = Number(p.amountPaid);
        if (isNaN(paidAmt) || paidAmt < 0) {
          paidAmt = Math.max(0, totalCost - dueAmt);
        }

        let cashAmt = Number(matchingItem?.cashPaidToSupplier) || 0;
        let bankAmt = Number(matchingItem?.bankPaidToSupplier) || 0;

        const pType = String(p.paymentType || matchingItem?.paymentMethod || 'Cash').toLowerCase();

        if (cashAmt === 0 && bankAmt === 0 && paidAmt > 0) {
          if (pType.includes('bank') || pType.includes('online') || pType.includes('transfer') || pType.includes('easy')) {
            bankAmt = paidAmt;
          } else if (pType.includes('split')) {
            cashAmt = Math.floor(paidAmt / 2);
            bankAmt = paidAmt - cashAmt;
          } else {
            cashAmt = paidAmt;
          }
        }

        let petiQty = Number(p.petiQuantity) > 0
          ? Number(p.petiQuantity)
          : (matchingItem?.petiQuantity > 0 ? Number(matchingItem.petiQuantity) : (Number(p.eggQuantity) > 0 ? Number((p.eggQuantity / 360).toFixed(2)) : 0));
        let trayQty = Number(p.trayQuantity) > 0
          ? Number(p.trayQuantity)
          : (matchingItem?.trayQuantity > 0 ? Number(matchingItem.trayQuantity) : 0);
        let eggQty = Number(p.eggQuantity) > 0
          ? Number(p.eggQuantity)
          : (matchingItem?.eggQuantity > 0 ? Number(matchingItem.eggQuantity) : (Number(matchingItem?.stock) || 0));

        if (petiQty > 0 && trayQty === 0) trayQty = Math.round(petiQty * 12);
        if (petiQty > 0 && eggQty === 0) eggQty = Math.round(petiQty * 360);
        if (trayQty > 0 && eggQty === 0) eggQty = Math.round(trayQty * 30);
        if (eggQty > 0 && petiQty === 0) petiQty = Number((eggQty / 360).toFixed(2));
        if (eggQty > 0 && trayQty === 0) trayQty = Math.round(eggQty / 30);

        // Deduct sold stock from purchase volume to get net in-hand remaining stock
        const currentEggs = matchingItem && matchingItem.stock !== undefined ? Number(matchingItem.stock) : eggQty;
        const remainingPetis = matchingItem && matchingItem.petiQuantity !== undefined ? Number(matchingItem.petiQuantity) : Number((currentEggs / 360).toFixed(2));
        const remainingTrays = matchingItem && matchingItem.trayQuantity !== undefined ? Number(matchingItem.trayQuantity) : Math.round(currentEggs / 30);
        const soldEggs = Math.max(0, eggQty - currentEggs);
        const soldPetis = Number((soldEggs / 360).toFixed(2));

        purchasesList.push({
          id: pId,
          shopId: p.shopId,
          date: p.purchaseDate || p.createdAt,
          createdAt: p.createdAt || p.purchaseDate,
          supplierName: p.supplierName || matchingItem?.supplierName || 'Farm Vendor',
          supplierPhone: p.supplierPhone || matchingItem?.supplierPhone || '',
          supplierLocation: p.supplierLocation || matchingItem?.supplierLocation || '',
          productName: p.productName || matchingItem?.name || 'Eggs Stock',
          category: p.category || matchingItem?.category || 'Eggs',
          petisPurchased: Number(petiQty) || 0,
          totalPurchasedEggs: Number(eggQty) || 0,
          petiQuantity: remainingPetis, // Net purchase product minus sold product
          petisCount: remainingPetis,
          trayQuantity: remainingTrays,
          traysCount: remainingTrays,
          eggQuantity: currentEggs,
          stock: currentEggs,
          remainingStock: currentEggs,
          remainingPetis,
          remainingTrays,
          soldQuantity: soldPetis,
          soldEggs,
          totalEggsCount: currentEggs,
          quantityText: p.quantityText || matchingItem?.quantityText || '',
          unitType: p.unitType || 'peti',
          buyCost: Number(p.buyCost) || Number(matchingItem?.costPrice) || 0,
          totalCost: Math.round(totalCost),
          amountPaid: Math.round(paidAmt),
          cashPaid: Math.round(cashAmt),
          bankPaid: Math.round(bankAmt),
          dueAmount: Math.round(dueAmt),
          paymentMethod: p.paymentType || matchingItem?.paymentMethod || (dueAmt > 0 ? 'Credit' : 'Cash'),
          status: dueAmt === 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : 'CREDIT')
        });
      });

      // Also include any items that weren't captured in purchases table
      (rawItems || []).forEach(it => {
        const itId = String(it.id || it._id);
        if (!seenItemIds.has(itId) && (Number(it.totalPurchaseCost) > 0 || Number(it.petiQuantity) > 0 || Number(it.stock) > 0)) {
          const totalCost = Number(it.totalPurchaseCost) || (Number(it.petiQuantity || 0) * Number(it.costPrice || 0));
          const dueAmt = Number(it.dueAmountToSupplier) || 0;
          const paidAmt = Number(it.amountPaidToSupplier) || Math.max(0, totalCost - dueAmt);
          let cashAmt = Number(it.cashPaidToSupplier) || 0;
          let bankAmt = Number(it.bankPaidToSupplier) || 0;
          const pMethod = String(it.paymentMethod || 'Cash').toLowerCase();

          if (cashAmt === 0 && bankAmt === 0 && paidAmt > 0) {
            if (pMethod.includes('bank') || pMethod.includes('online')) bankAmt = paidAmt;
            else cashAmt = paidAmt;
          }

          let petiQty = Number(it.petiQuantity) || (Number(it.stock) > 0 ? Number((it.stock / 360).toFixed(2)) : 0);
          let trayQty = Number(it.trayQuantity) || 0;
          let eggQty = Number(it.eggQuantity) || Number(it.stock) || 0;

          if (petiQty > 0 && trayQty === 0) trayQty = Math.round(petiQty * 12);
          if (petiQty > 0 && eggQty === 0) eggQty = Math.round(petiQty * 360);
          if (trayQty > 0 && eggQty === 0) eggQty = Math.round(trayQty * 30);
          if (eggQty > 0 && petiQty === 0) petiQty = Number((eggQty / 360).toFixed(2));
          if (eggQty > 0 && trayQty === 0) trayQty = Math.round(eggQty / 30);

          const currentEggs = Number(it.stock !== undefined ? it.stock : it.eggQuantity) || 0;
          const remainingPetis = Number(it.petiQuantity) || Number((currentEggs / 360).toFixed(2));
          const remainingTrays = Number(it.trayQuantity) || Math.round(currentEggs / 30);
          const initialEggs = Math.max(currentEggs, Number(it.eggQuantity || 0), (Number(petiQty) * 360));
          const soldEggs = Math.max(0, initialEggs - currentEggs);
          const soldPetis = Number((soldEggs / 360).toFixed(2));

          purchasesList.push({
            id: `item-${itId}`,
            shopId: it.shopId,
            date: it.createdAt,
            createdAt: it.createdAt,
            supplierName: it.supplierName || 'Farm Vendor',
            supplierPhone: it.supplierPhone || '',
            supplierLocation: it.supplierLocation || '',
            productName: it.name || 'Eggs Stock',
            category: it.category || 'Eggs',
            petisPurchased: Number(petiQty) || 0,
            totalPurchasedEggs: initialEggs,
            petiQuantity: remainingPetis, // Subtracted sold product from purchase product
            petisCount: remainingPetis,
            trayQuantity: remainingTrays,
            traysCount: remainingTrays,
            eggQuantity: currentEggs,
            stock: currentEggs,
            remainingStock: currentEggs,
            remainingPetis,
            remainingTrays,
            soldQuantity: soldPetis,
            soldEggs,
            totalEggsCount: currentEggs,
            quantityText: it.quantityText || '',
            unitType: it.unitType || 'peti',
            buyCost: Number(it.costPrice) || 0,
            totalCost: Math.round(totalCost),
            amountPaid: Math.round(paidAmt),
            cashPaid: Math.round(cashAmt),
            bankPaid: Math.round(bankAmt),
            dueAmount: Math.round(dueAmt),
            paymentMethod: it.paymentMethod || (dueAmt > 0 ? 'Credit' : 'Cash'),
            status: dueAmt === 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : 'CREDIT')
          });
        }
      });
    }

    purchasesList.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    // 3. Compute High-Level Totals
    const customerTotalRevenue = salesList.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalCashReceived = salesList.reduce((acc, s) => acc + s.cashPaid, 0);
    const totalBankReceived = salesList.reduce((acc, s) => acc + s.bankPaid, 0);
    const customerCreditDueTotal = salesList.reduce((acc, s) => acc + s.dueAmount, 0);
    const totalCustomerPetisSold = salesList.reduce((acc, s) => acc + s.petisBought, 0);
    const totalPaymentsCollected = totalCashReceived + totalBankReceived;

    const supplierTotalCost = purchasesList.reduce((acc, p) => acc + p.totalCost, 0);
    const supplierCashPaid = purchasesList.reduce((acc, p) => acc + p.cashPaid, 0);
    const supplierBankPaid = purchasesList.reduce((acc, p) => acc + p.bankPaid, 0);
    const supplierCreditDueTotal = purchasesList.reduce((acc, p) => acc + p.dueAmount, 0);
    const totalSupplierPetisBought = purchasesList.reduce((acc, p) => acc + p.petisPurchased, 0);
    const totalSupplierPaid = supplierCashPaid + supplierBankPaid;

    const netCashFlow = totalCashReceived - supplierCashPaid;
    const netBankFlow = totalBankReceived - supplierBankPaid;
    const netTotalFlow = totalPaymentsCollected - totalSupplierPaid;

    res.json({
      success: true,
      shopId: targetShopId,
      summary: {
        totalPaymentsCollected,
        totalCashReceived,
        totalBankReceived,
        customerCreditDueTotal,
        customerTotalRevenue,
        totalCustomerPetisSold,
        salesCount: salesList.length,

        supplierTotalCost,
        supplierCashPaid,
        supplierBankPaid,
        supplierCreditDueTotal,
        totalSupplierPaid,
        totalSupplierPetisBought,
        purchasesCount: purchasesList.length,

        netCashFlow,
        netBankFlow,
        netTotalFlow
      },
      sales: salesList,
      purchases: purchasesList
    });
  } catch (err) {
    console.error('[payment-ledger API error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all sales (shop admin - their shop only)
router.get('/', authenticate, requireShopAdmin, async (req, res) => {
  try {
    const rawShopId = req.query.shopId || (req.user && req.user.shopId);
    let filter = {};
    let targetShopId = null;
    if (rawShopId) {
      targetShopId = await resolveShopId(rawShopId);
      if (targetShopId) {
        filter = { shopId: targetShopId };
      }
    }
    const sales = await Sale.find(filter).sort({ saleDate: -1 });
    const pfx = (targetShopId && BRANCH_TABLE_PREFIXES[targetShopId]) || (rawShopId && BRANCH_TABLE_PREFIXES[rawShopId]) || 'peshawar_branch';
    const hydratedSales = await Promise.all((sales || []).map(s => hydrateSaleItems(s, pfx)));
    res.json(hydratedSales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Helper function to create sale record with custom payment routing
const createSaleRecord = async (req, res, explicitPaymentData = {}) => {
  const { items, totalAmount, totalProfit, cashierName, customerName, shopId } = req.body;
  const rawShopId = req.user?.shopId || shopId;
  const targetShopId = await resolveShopId(rawShopId) || 1;
  
  try {
    // 0. Super Admin permission check for Walk-In Billing
    const isApproved = await checkBranchApproval(req, 'edit', 'walkin');
    if (!isApproved) {
      return res.status(403).json({
        success: false,
        message: '🔒 Walk-In Billing is locked by Super Admin for this branch. Operation not allowed.'
      });
    }

    // 1. Fetch current settings for the invoice
    let settings = await Settings.findOne({ shopId: targetShopId });
    if (!settings) {
      try {
        settings = await Settings.create({ shopId: targetShopId });
      } catch (sErr) {
        settings = { shopId: targetShopId };
      }
    }

    // 2. Resolve Payment Breakdown (Cash, Bank, Credit)
    const method = String(explicitPaymentData.paymentMethod || req.body.paymentMethod || 'CASH').toUpperCase();
    const isBank = method === 'BANK_TRANSFER' || method === 'BANK' || method === 'ONLINE' || method === 'EASYPAISA';
    const isCredit = method === 'CREDIT' || method === 'DUE' || explicitPaymentData.isCredit === true;

    const totalAmt = Number(totalAmount) || 0;
    let cashPaid = 0;
    let bankPaid = 0;
    let dueAmount = 0;

    if (req.body.cashPaid !== undefined || req.body.bankPaid !== undefined || req.body.dueAmount !== undefined) {
      cashPaid = Math.max(0, Number(req.body.cashPaid) || 0);
      bankPaid = Math.max(0, Number(req.body.bankPaid) || 0);
      if (req.body.dueAmount !== undefined) {
        dueAmount = Math.max(0, Number(req.body.dueAmount) || 0);
      } else {
        dueAmount = Math.max(0, totalAmt - (cashPaid + bankPaid));
      }
    } else if (method === 'CASH') {
      cashPaid = totalAmt;
      dueAmount = 0;
    } else if (isBank) {
      bankPaid = totalAmt;
      dueAmount = 0;
    } else if (isCredit) {
      dueAmount = totalAmt;
      cashPaid = 0;
      bankPaid = 0;
    } else if (method === 'SPLIT' || method === 'PARTIAL') {
      cashPaid = Number(req.body.cashPaid) || 0;
      bankPaid = Number(req.body.bankPaid) || 0;
      dueAmount = Math.max(0, totalAmt - (cashPaid + bankPaid));
    } else {
      cashPaid = totalAmt;
      dueAmount = 0;
    }

    const paymentReceipt = req.body.paymentReceipt || req.body.paymentProof || explicitPaymentData.paymentReceipt || '';

    // Generate unique serial number
    let existingCount = 0;
    try {
      existingCount = await Sale.countDocuments({ shopId: targetShopId });
    } catch (cErr) { }
    const saleItems = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items || '[]') : []);

    // ── STRICT DYNAMIC STOCK VALIDATION (Online Server & POS Enforcement) ──
    // Prevent sales when product is low stock or out of stock (stock <= 0 or requested > available)
    for (const it of saleItems) {
      const prodId = it.productId || it.itemId || it._id || it.id;
      if (prodId) {
        const product = await Item.findById(prodId);
        if (product) {
          const availStock = Number(product.stock) || 0;
          const qty = Number(it.quantity) || 1;
          const uType = String(it.unitLabel || it.unit || it.unitType || product.unitType || 'peti').toLowerCase();
          const tPerP = Number(product.traysPerPeti) || 12;
          const ePerT = Number(product.eggsPerTray) || 30;
          const ePerP = tPerP * ePerT || 360;

          let eggsRequired = 0;
          if (Number(it.totalEggs) > 0) {
            eggsRequired = Number(it.totalEggs);
          } else if (uType.includes('peti')) {
            eggsRequired = qty * ePerP;
          } else if (uType.includes('tray')) {
            eggsRequired = qty * ePerT;
          } else {
            eggsRequired = qty;
          }

          if (availStock <= 0) {
            return res.status(400).json({
              success: false,
              message: `Cannot complete sale: Product "${product.name}" is completely Out of Stock (0 remaining). Please restock before selling.`
            });
          }

          if (eggsRequired > availStock) {
            const availPetis = (availStock / ePerP).toFixed(1);
            return res.status(400).json({
              success: false,
              message: `Cannot complete sale: Insufficient stock for "${product.name}". Available: ${availStock} eggs (${availPetis} Petis), but requested ${eggsRequired} eggs. Please adjust quantity or restock.`
            });
          }
        }
      }
    }
    const serialNumber = 1 + existingCount;
    const invoiceNumber = req.body.invoiceNumber || explicitPaymentData.invoiceNumber || (settings?.invoicePrefix ? `${settings.invoicePrefix}-${String(serialNumber).padStart(5, '0')}` : `INV-${String(serialNumber).padStart(5, '0')}`);
    let computedPetis = 0;
    let computedEggs = 0;
    const descParts = [];

    for (const it of saleItems) {
      const qty = Number(it.quantity) || 1;
      const uType = (it.unitLabel || it.unit || it.unitType || 'peti').toLowerCase();
      const nm = it.rawProductName || it.name || 'Eggs';
      let petis = 0;
      let eggs = 0;
      if (uType.includes('peti')) {
        petis = qty;
        eggs = qty * 360;
      } else if (uType.includes('tray')) {
        petis = qty / 12;
        eggs = qty * 30;
      } else {
        eggs = Number(it.totalEggs) > 0 ? Number(it.totalEggs) : qty;
        petis = eggs / 360;
      }
      if (Number(it.petiQuantity) > 0) petis = Number(it.petiQuantity);
      if (Number(it.totalEggs) > 0) eggs = Number(it.totalEggs);
      computedPetis += petis;
      computedEggs += eggs;
      descParts.push(`${nm} (${qty} ${uType})`);
    }

    if (computedPetis === 0 && computedEggs === 0 && totalAmt > 0) {
      computedPetis = Number((totalAmt / 1050).toFixed(2)) || 1;
      computedEggs = Math.round(computedPetis * 360);
    }

    const itemsDesc = descParts.join(', ') || req.body.itemsDescription || 'Eggs Stock';
    const mainCategory = (saleItems[0]?.category) || req.body.category || 'Eggs';

    const salePayload = {
      shopId: targetShopId,
      items: saleItems,
      totalAmount: totalAmt,
      totalProfit: Number(totalProfit) || 0,
      serialNumber,
      invoiceNumber,
      itemsDescription: itemsDesc,
      petisBought: Number(computedPetis.toFixed(2)),
      eggsBought: Math.round(computedEggs),
      category: mainCategory,
      cashierName: cashierName || req.user?.fullName || "Shop Admin",
      customerName: customerName || (isCredit ? "Credit Customer" : "Walk-in Customer"),
      customerPhone: req.body.customerPhone || "",
      customerEmail: req.body.customerEmail || "",
      customerId: req.body.customerId || null,
      paymentMethod: method,
      cashPaid,
      bankPaid,
      dueAmount,
      paymentReceipt,
      paymentProof: paymentReceipt,
      transactionId: req.body.transactionId || "",
      isCredit: isCredit || dueAmount > 0,
      approvalStatus: req.body.approvalStatus || (isBank ? 'PENDING_APPROVAL' : 'APPROVED'),
      saleDate: new Date()
    };
    
    // Automatically register walk-in customer in database if name is provided
    let finalCustomerName = salePayload.customerName;
    const isGeneric = !finalCustomerName || finalCustomerName.toLowerCase() === 'walk-in customer' || finalCustomerName.toLowerCase() === 'walk-in' || finalCustomerName.toLowerCase() === 'cash customer';
    
    if (!isGeneric && !salePayload.customerId) {
      try {
        const existingCust = await Customer.findOne({ fullName: finalCustomerName, shopId: targetShopId });
        if (!existingCust) {
          const cleanPhone = (salePayload.customerPhone || '').replace(/\D/g, '');
          const cleanName = finalCustomerName.toLowerCase().replace(/[^a-z0-9]/g, '');
          const fallbackEmail = salePayload.customerEmail || `${cleanName || 'cust'}_${cleanPhone || Date.now()}@walkin.local`;
          const newCust = await Customer.create({
            fullName: finalCustomerName,
            phone: salePayload.customerPhone || '',
            email: fallbackEmail,
            password: 'phys_' + Math.random().toString(36).substring(7), // dummy password for physical
            shopId: targetShopId
          });
          salePayload.customerId = newCust._id || newCust.id;
        } else {
          salePayload.customerId = existingCust._id || existingCust.id;
        }
      } catch (custErr) {
        console.error('Failed to auto-register walk-in customer:', custErr);
      }
    }
    
    // 3. Update stock for each item if items provided
    if (Array.isArray(saleItems) && saleItems.length > 0) {
      for (const item of saleItems) {
        const prodId = item.productId || item.itemId || item._id || item.id;
        if (prodId) {
          const product = await Item.findById(prodId);
          if (product) {
            const qty = Number(item.quantity) || 1;
            const uType = String(item.unitLabel || item.unit || item.unitType || product.unitType || 'peti').toLowerCase();
            const tPerP = Number(product.traysPerPeti) || 12;
            const ePerT = Number(product.eggsPerTray) || 30;
            const ePerP = tPerP * ePerT || 360;

            let stockToDeduct = 0;
            if (Number(item.totalEggs) > 0) {
              stockToDeduct = Number(item.totalEggs);
            } else if (uType.includes('peti')) {
              stockToDeduct = qty * ePerP;
            } else if (uType.includes('tray')) {
              stockToDeduct = qty * ePerT;
            } else {
              stockToDeduct = qty;
            }

            const newStock = Math.max(0, (Number(product.stock) || 0) - stockToDeduct);
            const newPetis = Math.max(0, Number((newStock / ePerP).toFixed(2)));
            const newTrays = Math.max(0, Math.round(newStock / ePerT));
            
            const itemUpdate = {
              stock: newStock,
              petiQuantity: newPetis,
              trayQuantity: newTrays,
              eggQuantity: newStock,
              lastUpdated: new Date().toISOString().split('T')[0]
            };

            await Item.findByIdAndUpdate(product.id || product._id, itemUpdate);

            // Also update purchases table if a purchase row exists for this itemId
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
    }
    
    const newSale = await Sale.create(salePayload);

    // Auto-create CustomerPaymentLedger record for EVERY sale (online & local dynamic tracking)
    if (newSale) {
      try {
        const cplDue = Number(newSale.dueAmount) || 0;
        const cplCash = Number(newSale.cashPaid) || 0;
        const cplBank = Number(newSale.bankPaid) || 0;
        const cplStatus = cplDue <= 0 ? 'PAID' : (cplCash > 0 || cplBank > 0 ? 'PARTIAL' : 'CREDIT');

        await CustomerPaymentLedger.create({
          shopId: targetShopId,
          saleId: String(newSale.id || newSale._id),
          invoiceNumber: newSale.invoiceNumber || invoiceNumber,
          date: newSale.saleDate || new Date(),
          customerName: newSale.customerName || 'Walk-in Customer',
          customerPhone: newSale.customerPhone || '',
          customerEmail: newSale.customerEmail || '',
          totalAmount: totalAmt,
          cashPaid: cplCash,
          bankPaid: cplBank,
          dueAmount: cplDue,
          paymentMethod: method,
          petisBought: Number(computedPetis.toFixed(2)),
          eggsBought: Math.round(computedEggs),
          itemsDescription: itemsDesc,
          items: saleItems,
          category: mainCategory,
          status: cplStatus
        });

        // Also insert into sale_items table if present for multi-table compatibility
        const sIdNum = Number(newSale.id || newSale._id);
        if (sIdNum && Array.isArray(saleItems) && saleItems.length > 0) {
          const branchPfx = (targetShopId && BRANCH_TABLE_PREFIXES[targetShopId]) || 'peshawar_branch';
          for (const item of saleItems) {
            const pId = Number(item.productId || item.itemId || item.id) || null;
            const qty = Number(item.quantity) || 1;
            const pr = Number(item.price) || 0;
            const cp = Number(item.costPrice) || 0;
            const sub = Number(item.subtotal) || (qty * pr);
            const prof = Number(item.profit) || Math.max(0, sub - (qty * cp));
            const itemName = item.rawProductName || item.name || 'Eggs';

            await pool.query(
              `INSERT INTO \`${branchPfx}__sale_items\` (saleId, productId, name, quantity, price, costPrice, subtotal, profit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [sIdNum, pId, itemName, qty, pr, cp, sub, prof]
            ).catch(async () => {
              await pool.query(
                `INSERT INTO \`sale_items\` (saleId, productId, name, quantity, price, costPrice, subtotal, profit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [sIdNum, pId, itemName, qty, pr, cp, sub, prof]
              ).catch(() => {});
            });
          }
        }
      } catch (cplErr) {
        console.warn('[createSaleRecord] CustomerPaymentLedger creation notice:', cplErr.message);
      }
    }

    // Auto-create CustomerCredit record if sale has due balance or is credit
    if (newSale && (Number(newSale.dueAmount) > 0 || newSale.isCredit)) {
      try {
        const total = Number(newSale.totalAmount || 0);
        const paid = (Number(newSale.cashPaid) || 0) + (Number(newSale.bankPaid) || 0);
        const due = Number(newSale.dueAmount || 0);
        const status = due <= 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID');

        await CustomerCredit.create({
          shopId: newSale.shopId,
          customerId: newSale.customerId || null,
          saleId: newSale.id || newSale._id,
          customerName: newSale.customerName || 'Credit Customer',
          customerPhone: newSale.customerPhone || '',
          customerEmail: newSale.customerEmail || '',
          totalAmount: total,
          paidAmount: paid,
          dueAmount: due,
          status: status,
          notes: newSale.invoiceNumber || '',
          paymentMethod: newSale.paymentMethod || 'CASH'
        });
      } catch (ccErr) {
        console.error('[createSaleRecord] CustomerCredit creation error:', ccErr.message);
      }
    }

    // 4. Update active CashSession
    if (cashPaid > 0) {
      try {
        const activeSession = await CashSession.findOne({ status: 'open' });
        if (activeSession) {
          await CashSession.findByIdAndUpdate(activeSession.id, {
            totalSales: (Number(activeSession.totalSales) || 0) + cashPaid,
            expectedCash: (Number(activeSession.expectedCash) || 0) + cashPaid
          });
        }
      } catch (csErr) { }
    }

    // 5. Generate PDF Invoice
    const fileName = `invoice-${newSale._id || newSale.id}.pdf`;
    const invoicesDir = path.join(__dirname, '..', 'invoices');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }
    const filePath = path.join(invoicesDir, fileName);
    
    try {
      await generateInvoice(newSale, filePath, settings);
      const responseData = typeof newSale.toObject === 'function' ? newSale.toObject() : { ...newSale };
      responseData.invoiceUrl = `/invoices/${fileName}`;
      res.status(201).json(responseData);
    } catch (pdfErr) {
      const responseData = typeof newSale.toObject === 'function' ? newSale.toObject() : { ...newSale };
      res.status(201).json(responseData);
    }
  } catch (err) {
    console.error('[createSaleRecord error]:', err);
    res.status(500).json({ message: err.message });
  }
};

// Create a standard sale
router.post('/', authenticate, requireShopAdmin, async (req, res) => {
  await createSaleRecord(req, res);
});

// ── DEDICATED ROUTE 1: CASH SALE ──
router.post('/cash', authenticate, requireShopAdmin, async (req, res) => {
  await createSaleRecord(req, res, { paymentMethod: 'CASH' });
});

// ── DEDICATED ROUTE 2: BANK / ONLINE SALE WITH RECEIPT PROOF ──
router.post('/bank', authenticate, requireShopAdmin, async (req, res) => {
  await createSaleRecord(req, res, { paymentMethod: 'BANK_TRANSFER' });
});

router.post('/online', authenticate, requireShopAdmin, async (req, res) => {
  await createSaleRecord(req, res, { paymentMethod: 'ONLINE' });
});

// ── DEDICATED ROUTE 3: CREDIT (DUE BALANCE) SALE ──
router.post('/credit', authenticate, requireShopAdmin, async (req, res) => {
  await createSaleRecord(req, res, { paymentMethod: 'CREDIT', isCredit: true });
});

router.post('/due', authenticate, requireShopAdmin, async (req, res) => {
  await createSaleRecord(req, res, { paymentMethod: 'CREDIT', isCredit: true });
});

// ── SALES BREAKDOWN & SUMMARY ROUTE (Cash, Bank, Credit) ──
router.get('/breakdown/:shopId?', authenticate, async (req, res) => {
  try {
    const rawShopId = req.params.shopId || req.query.shopId || req.user?.shopId;
    let filter = {};
    if (rawShopId) {
      const targetShopId = await resolveShopId(rawShopId);
      if (targetShopId) {
        filter = { shopId: targetShopId };
      }
    }
    const allSales = await Sale.find(filter);

    let totalCash = 0;
    let totalBank = 0;
    let totalCredit = 0;
    let totalGrossSales = 0;

    allSales.forEach(s => {
      totalGrossSales += (Number(s.totalAmount) || 0);
      if (s.cashPaid !== undefined || s.bankPaid !== undefined || s.dueAmount !== undefined) {
        totalCash += (Number(s.cashPaid) || 0);
        totalBank += (Number(s.bankPaid) || 0);
        totalCredit += (Number(s.dueAmount) || 0);
      } else {
        // Fallback for older sales
        const m = String(s.paymentMethod || 'CASH').toUpperCase();
        if (m === 'CASH') totalCash += (Number(s.totalAmount) || 0);
        else if (m === 'BANK_TRANSFER' || m === 'BANK' || m === 'ONLINE' || m === 'EASYPAISA') totalBank += (Number(s.totalAmount) || 0);
        else if (m === 'CREDIT' || m === 'DUE') totalCredit += (Number(s.totalAmount) || 0);
        else totalCash += (Number(s.totalAmount) || 0);
      }
    });

    res.json({
      success: true,
      totalGrossSales,
      totalCash,
      totalBank,
      totalCredit,
      totalCount: allSales.length
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET SALES FILTERED BY TYPE (cash | bank | credit) ──
router.get('/by-type/:type', authenticate, requireShopAdmin, async (req, res) => {
  try {
    const type = req.params.type.toLowerCase();
    const rawShopId = req.query.shopId || req.user?.shopId;
    let filter = {};
    if (rawShopId) {
      const targetShopId = await resolveShopId(rawShopId);
      if (targetShopId) {
        filter.shopId = targetShopId;
      }
    }

    if (type === 'cash') {
      filter.$or = [{ paymentMethod: 'CASH' }, { cashPaid: { $gt: 0 } }];
    } else if (type === 'bank' || type === 'online') {
      filter.$or = [{ paymentMethod: { $in: ['BANK_TRANSFER', 'BANK', 'ONLINE', 'EASYPAISA'] } }, { bankPaid: { $gt: 0 } }];
    } else if (type === 'credit' || type === 'due') {
      filter.$or = [{ paymentMethod: { $in: ['CREDIT', 'DUE'] } }, { isCredit: true }, { dueAmount: { $gt: 0 } }];
    }

    const sales = await Sale.find(filter).sort({ saleDate: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Return a sale (and reverse stock)
router.put('/:id/return', authenticate, requireShopAdmin, async (req, res) => {
  const { reason } = req.body;
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale || sale.status === 'returned') {
      return res.status(404).json({ message: 'Sale not found or already returned' });
    }

    // 1. Reverse stock for each item
    for (const item of (sale.items || [])) {
      const pId = item.productId || item.id || item._id;
      if (pId) {
        const product = await Item.findById(pId);
        if (product) {
          const qty = Number(item.quantity) || 1;
          const stockToAdd = Number(item.totalEggs) > 0 ? Number(item.totalEggs) : qty;
          const newStock = (Number(product.stock) || 0) + stockToAdd;
          const updateObj = { stock: newStock, lastUpdated: new Date().toISOString().split('T')[0] };
          if (product.unitType === 'peti') {
            updateObj.petiQuantity = (Number(product.petiQuantity) || 0) + qty;
          } else if (product.unitType === 'tray') {
            updateObj.trayQuantity = (Number(product.trayQuantity) || 0) + qty;
          } else if (product.unitType === 'egg') {
            updateObj.eggQuantity = newStock;
          }
          await Item.findByIdAndUpdate(product.id, updateObj);
        }
      }
    }

    // 2. Update sale record in MySQL
    const updatedSale = await Sale.findByIdAndUpdate(sale.id, {
      status: 'returned',
      returnReason: reason || "Customer Return",
      returnDate: new Date()
    }, { new: true });

    // 3. Update active CashSession
    if (Number(sale.cashPaid) > 0) {
      try {
        const activeSession = await CashSession.findOne({ status: 'open' });
        if (activeSession) {
          await CashSession.findByIdAndUpdate(activeSession.id, {
            totalReturns: (Number(activeSession.totalReturns) || 0) + Number(sale.cashPaid),
            expectedCash: Math.max(0, (Number(activeSession.expectedCash) || 0) - Number(sale.cashPaid))
          });
        }
      } catch (e) { }
    }

    res.json(updatedSale);
  } catch (err) {
    console.error('Return sale error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Edit a sale (and adjust stock)
router.put('/:id', authenticate, requireShopAdmin, async (req, res) => {
  const canEdit = await checkBranchApproval(req, 'edit');
  if (!canEdit) {
    return res.status(403).json({ message: "🔒 Super Admin Approval Required: Edit actions are locked for this branch." });
  }
  const { items, totalAmount, totalProfit, customerName, customerPhone, customerEmail, paymentMethod, cashPaid, bankPaid, dueAmount, saleDate, invoiceNumber } = req.body;
  try {
    const targetId = req.params.id;
    let sale = await Sale.findById(targetId);
    if (!sale && String(targetId).startsWith('cpl-')) {
      const rawId = String(targetId).replace('cpl-', '');
      sale = await Sale.findById(rawId);
    }
    if (!sale) {
      sale = await Sale.findOne({ invoiceNumber: targetId });
    }
    if (!sale) {
      sale = await Sale.findOne({ orderId: targetId });
    }

    if (!sale) {
      // Check Order collection directly
      try {
        const order = await Order.findById(targetId);
        if (order) {
          const ordUpdate = {};
          if (customerName !== undefined) ordUpdate.customerName = customerName;
          if (customerPhone !== undefined) ordUpdate.customerPhone = customerPhone;
          if (customerEmail !== undefined) ordUpdate.customerEmail = customerEmail;
          if (totalAmount !== undefined) ordUpdate.totalAmount = Number(totalAmount);
          if (paymentMethod !== undefined) ordUpdate.paymentMethod = paymentMethod;
          if (items !== undefined) ordUpdate.items = items;
          const updatedOrder = await Order.findByIdAndUpdate(order.id, ordUpdate, { new: true });
          return res.json({ success: true, message: 'Order sale updated successfully', ...updatedOrder, sale: updatedOrder });
        }
      } catch (ordErr) { }
      return res.status(404).json({ message: 'Sale not found' });
    }

    const oldCashPaid = Number(sale.cashPaid) || 0;

    // Adjust stock differences if items are edited
    const oldSaleItems = Array.isArray(sale.items) ? sale.items : (typeof sale.items === 'string' ? JSON.parse(sale.items || '[]') : []);
    if (Array.isArray(items) && Array.isArray(oldSaleItems)) {
      for (const newItem of items) {
        const oldItem = oldSaleItems.find(i => String(i.productId || i.id || i._id) === String(newItem.productId || newItem.id || newItem._id));
        if (oldItem) {
          const qtyDifference = (Number(newItem.quantity) || 1) - (Number(oldItem.quantity) || 1);
          if (qtyDifference !== 0) {
            const product = await Item.findById(newItem.productId || newItem.id || newItem._id);
            if (product) {
              const stockDiff = Number(newItem.totalEggs) > 0 ? (Number(newItem.totalEggs) - (Number(oldItem.totalEggs) || 0)) : qtyDifference;
              const newStock = Math.max(0, (Number(product.stock) || 0) - stockDiff);
              await Item.findByIdAndUpdate(product.id, { stock: newStock, lastUpdated: new Date().toISOString().split('T')[0] });
            }
          }
        }
      }
    }

    const updateData = {};
    if (items !== undefined) updateData.items = items;
    if (totalAmount !== undefined) updateData.totalAmount = Number(totalAmount);
    if (totalProfit !== undefined) updateData.totalProfit = Number(totalProfit);
    if (customerName !== undefined) updateData.customerName = customerName;
    if (customerPhone !== undefined) updateData.customerPhone = customerPhone;
    if (customerEmail !== undefined) updateData.customerEmail = customerEmail;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (cashPaid !== undefined) updateData.cashPaid = Number(cashPaid);
    if (bankPaid !== undefined) updateData.bankPaid = Number(bankPaid);
    if (dueAmount !== undefined) {
      updateData.dueAmount = Number(dueAmount);
      updateData.isCredit = Number(dueAmount) > 0;
    }
    if (saleDate !== undefined) updateData.saleDate = new Date(saleDate);
    if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber;

    const updatedSale = await Sale.findByIdAndUpdate(sale.id, updateData, { new: true });

    // Sync Customer table if customerId exists or matches email/phone
    if (sale.customerId || customerEmail || customerPhone) {
      try {
        const custUpdate = {};
        if (customerName) custUpdate.fullName = customerName;
        if (customerPhone) custUpdate.phone = customerPhone;
        if (customerEmail && customerEmail !== 'physical store pos') custUpdate.email = customerEmail;
        if (Object.keys(custUpdate).length > 0) {
          if (sale.customerId) {
            await Customer.findByIdAndUpdate(sale.customerId, custUpdate);
          }
          if (customerEmail && customerEmail !== 'physical store pos') {
            await Customer.updateMany({ email: customerEmail.toLowerCase() }, { $set: custUpdate });
          }
          if (customerPhone && customerPhone.length >= 7) {
            await Customer.updateMany({ phone: customerPhone }, { $set: custUpdate });
          }
        }
      } catch (custErr) {
        console.warn('Customer table sync warning:', custErr.message);
      }
    }

    // Sync with CustomerPaymentLedger branch table
    try {
      const cplId = String(targetId).startsWith('cpl-') ? targetId : `cpl-${sale.id}`;
      const cplUp = {};
      if (customerName !== undefined) cplUp.customerName = customerName;
      if (customerPhone !== undefined) cplUp.customerPhone = customerPhone;
      if (totalAmount !== undefined) cplUp.totalAmount = Number(totalAmount);
      if (cashPaid !== undefined) cplUp.cashPaid = Number(cashPaid);
      if (bankPaid !== undefined) cplUp.bankPaid = Number(bankPaid);
      if (dueAmount !== undefined) cplUp.dueAmount = Number(dueAmount);
      if (paymentMethod !== undefined) cplUp.paymentMethod = paymentMethod;
      if (req.body.category !== undefined) cplUp.category = req.body.category;
      const calcDue = cplUp.dueAmount !== undefined ? cplUp.dueAmount : Number(sale.dueAmount || 0);
      cplUp.status = calcDue === 0 ? 'PAID' : 'PARTIAL';

      if (Array.isArray(items) && items.length > 0) {
        let petis = 0;
        let eggs = 0;
        const descParts = [];
        items.forEach(it => {
          const qty = Number(it.quantity) || 1;
          const u = (it.unitLabel || it.unit || '').toLowerCase();
          const n = (it.rawProductName || it.name || '').toLowerCase();
          if (u.includes('peti') || n.includes('peti')) {
            petis += qty;
            eggs += qty * 360;
          } else if (u.includes('tray') || n.includes('tray')) {
            eggs += qty * 30;
          } else {
            eggs += Number(it.totalEggs) > 0 ? Number(it.totalEggs) : qty;
          }
          descParts.push(`${it.rawProductName || it.name || 'Eggs'} (x${qty})`);
        });
        cplUp.petisBought = petis;
        cplUp.eggsBought = eggs;
        cplUp.itemsDescription = descParts.join(', ');
      }

      await CustomerPaymentLedger.findByIdAndUpdate(cplId, cplUp);
      await CustomerPaymentLedger.findOneAndUpdate({ saleId: String(sale.id) }, cplUp);
    } catch (cplErr) {
      console.warn('CustomerPaymentLedger sync warning:', cplErr.message);
    }

    // Sync linked Order if exists
    if (sale.orderId) {
      try {
        await Order.findByIdAndUpdate(sale.orderId, {
          customerName: updateData.customerName || sale.customerName,
          customerPhone: updateData.customerPhone || sale.customerPhone,
          customerEmail: updateData.customerEmail || sale.customerEmail,
          totalAmount: updateData.totalAmount !== undefined ? updateData.totalAmount : sale.totalAmount,
          paymentMethod: updateData.paymentMethod || sale.paymentMethod
        });
      } catch (e) { }
    }

    // Update active CashSession if cash amount changed
    if (cashPaid !== undefined && cashPaid !== oldCashPaid) {
      try {
        const activeSession = await CashSession.findOne({ status: 'open' });
        if (activeSession) {
          const diff = Number(cashPaid) - oldCashPaid;
          await CashSession.findByIdAndUpdate(activeSession.id, {
            totalSales: Math.max(0, (Number(activeSession.totalSales) || 0) + diff),
            expectedCash: Math.max(0, (Number(activeSession.expectedCash) || 0) + diff)
          });
        }
      } catch (e) { }
    }

    res.json({ success: true, message: 'Sale updated successfully', ...updatedSale, sale: updatedSale });
  } catch (err) {
    console.error('Edit sale error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete a sale permanently from database (both Sale and Order if exists)
router.delete('/:id', authenticate, requireShopAdmin, async (req, res) => {
  const canDelete = await checkBranchApproval(req, 'delete');
  if (!canDelete) {
    return res.status(403).json({ message: "🔒 Super Admin Approval Required: Delete actions are locked for this branch." });
  }
  try {
    const targetId = req.params.id;
    if (!targetId) {
      return res.status(400).json({ message: 'Target ID is required' });
    }

    let sale = await Sale.findById(targetId);
    if (!sale && String(targetId).startsWith('cpl-')) {
      const rawId = String(targetId).replace('cpl-', '');
      sale = await Sale.findById(rawId);
    }
    if (!sale) {
      sale = await Sale.findOne({ invoiceNumber: targetId });
    }
    if (!sale) {
      sale = await Sale.findOne({ orderId: targetId });
    }

    if (sale) {
      const amountToDeduct = Number(sale.cashPaid || sale.totalAmount) || 0;

      // 1. Reverse inventory stock
      for (const item of (sale.items || [])) {
        const pId = item.productId || item.id || item._id;
        if (pId) {
          try {
            const product = await Item.findById(pId);
            if (product) {
              const qty = Number(item.quantity) || 1;
              const stockToAdd = Number(item.totalEggs) > 0 ? Number(item.totalEggs) : qty;
              const newStock = (Number(product.stock) || 0) + stockToAdd;
              const updateObj = { stock: newStock, lastUpdated: new Date().toISOString().split('T')[0] };
              if (product.unitType === 'peti') {
                updateObj.petiQuantity = (Number(product.petiQuantity) || 0) + qty;
              } else if (product.unitType === 'tray') {
                updateObj.trayQuantity = (Number(product.trayQuantity) || 0) + qty;
              } else if (product.unitType === 'egg') {
                updateObj.eggQuantity = newStock;
              }
              await Item.findByIdAndUpdate(product.id, updateObj);
            }
          } catch (e) { }
        }
      }

      // 2. Delete from MySQL sales and sale_items
      await Sale.findByIdAndDelete(sale.id);

      // 3. Delete associated Invoice PDF if it exists
      const fileName = `invoice-${sale.id || sale._id}.pdf`;
      const filePath = path.join(__dirname, '..', 'invoices', fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (fileErr) { }
      }

      // 4. Update active CashSession
      if (amountToDeduct > 0) {
        try {
          const activeSession = await CashSession.findOne({ status: 'open' });
          if (activeSession) {
            await CashSession.findByIdAndUpdate(activeSession.id, {
              totalSales: Math.max(0, (Number(activeSession.totalSales) || 0) - amountToDeduct),
              expectedCash: Math.max(0, (Number(activeSession.expectedCash) || 0) - amountToDeduct)
            });
          }
        } catch (e) { }
      }

      // 5. Delete linked order if any
      if (sale.orderId) {
        try {
          await Order.findByIdAndDelete(sale.orderId);
        } catch (e) { }
      }
    }

    // Also delete from CustomerPaymentLedger branch table
    try {
      await CustomerPaymentLedger.findByIdAndDelete(targetId);
      if (sale) {
        await CustomerPaymentLedger.findByIdAndDelete(`cpl-${sale.id}`);
        await CustomerPaymentLedger.deleteMany({ saleId: String(sale.id) });
      }
    } catch (cplDelErr) {
      console.warn('CustomerPaymentLedger delete warning:', cplDelErr.message);
    }

    // Also check Order collection directly
    try {
      await Order.findByIdAndDelete(targetId);
    } catch (ordErr) { }

    res.json({ success: true, message: 'Sale and associated records permanently deleted from database' });
  } catch (err) {
    console.error('Delete sale error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Dedicated Customer & Vendor Payment Ledger update/delete routes
router.put('/customer-payment-ledger/:id', authenticate, requireShopAdmin, async (req, res) => {
  const canEdit = await checkBranchApproval(req, 'edit', 'customerPaymentLedger');
  if (!canEdit) {
    return res.status(403).json({ message: "🔒 Super Admin Approval Required: Customer info edit is locked for this branch." });
  }
  try {
    const { id } = req.params;
    const updated = await CustomerPaymentLedger.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ success: true, ledger: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/customer-payment-ledger/:id', authenticate, requireShopAdmin, async (req, res) => {
  const canDelete = await checkBranchApproval(req, 'delete', 'customerPaymentLedger');
  if (!canDelete) {
    return res.status(403).json({ message: "🔒 Super Admin Approval Required: Customer ledger delete is locked for this branch." });
  }
  try {
    const { id } = req.params;
    await CustomerPaymentLedger.findByIdAndDelete(id);
    res.json({ success: true, message: 'Deleted from customer payment ledger' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/vendor-payment-ledger/:id', authenticate, requireShopAdmin, async (req, res) => {
  const canEdit = await checkBranchApproval(req, 'edit', 'vendors');
  if (!canEdit) {
    return res.status(403).json({ message: "🔒 Super Admin Approval Required: Vendor bill edit is locked for this branch." });
  }
  try {
    const { id } = req.params;
    const cleanId = String(id).replace(/^vpl-/, '').replace(/^item-/, '');
    const data = req.body || {};

    const sName = data.supplierName || '';
    const sPhone = data.supplierPhone || '';
    const sLoc = data.supplierLocation || '';
    const pName = data.productName || data.name || 'Product';
    const cat = data.category || 'Product';
    const qty = Number(data.petisPurchased !== undefined ? data.petisPurchased : (data.petiQuantity !== undefined ? data.petiQuantity : data.quantity)) || 0;
    const total = Number(data.totalCost !== undefined ? data.totalCost : data.totalPurchaseCost) || 0;
    const cash = Number(data.cashPaid !== undefined ? data.cashPaid : data.cashPaidToSupplier) || 0;
    const bank = Number(data.bankPaid !== undefined ? data.bankPaid : data.bankPaidToSupplier) || 0;
    const paid = Number(data.amountPaid !== undefined ? data.amountPaid : data.amountPaidToSupplier) || (cash + bank);
    const due = data.dueAmount !== undefined 
      ? Number(data.dueAmount) 
      : (data.dueAmountToSupplier !== undefined ? Number(data.dueAmountToSupplier) : Math.max(0, total - paid));
    const pMethod = data.paymentMethod || (due === 0 ? 'Cash' : (paid > 0 ? 'Split' : 'Credit'));

    // 1. Dynamic sync to purchases table in MySQL
    try {
      await pool.query(
        `UPDATE purchases 
         SET supplierName = COALESCE(?, supplierName), 
             supplierPhone = COALESCE(?, supplierPhone), 
             supplierLocation = COALESCE(?, supplierLocation), 
             productName = COALESCE(?, productName), 
             category = COALESCE(?, category), 
             petiQuantity = ?, 
             totalCost = ?, 
             amountPaid = ?, 
             dueAmount = ?, 
             paymentType = ?
         WHERE id = ? OR itemId = ?`,
        [sName || null, sPhone || null, sLoc || null, pName || null, cat || null, qty, total, paid, due, pMethod, cleanId, cleanId]
      );
    } catch (pErr) {
      console.warn('[vendor-payment-ledger PUT purchases sync warning]:', pErr.message);
    }

    // 2. Dynamic sync to items table in MySQL
    try {
      await pool.query(
        `UPDATE items 
         SET supplierName = COALESCE(?, supplierName), 
             supplierPhone = COALESCE(?, supplierPhone), 
             supplierLocation = COALESCE(?, supplierLocation), 
             name = COALESCE(?, name), 
             category = COALESCE(?, category), 
             petiQuantity = ?, 
             totalPurchaseCost = ?, 
             amountPaidToSupplier = ?, 
             cashPaidToSupplier = ?, 
             bankPaidToSupplier = ?, 
             dueAmountToSupplier = ?
         WHERE id = ?`,
        [sName || null, sPhone || null, sLoc || null, pName || null, cat || null, qty, total, paid, cash, bank, due, cleanId]
      );
    } catch (itErr) {
      console.warn('[vendor-payment-ledger PUT items sync warning]:', itErr.message);
    }

    // 3. Dynamic sync to purchase_credits table in MySQL
    try {
      await pool.query(
        `UPDATE purchase_credits 
         SET supplierName = COALESCE(?, supplierName), 
             supplierPhone = COALESCE(?, supplierPhone), 
             supplierLocation = COALESCE(?, supplierLocation), 
             productName = COALESCE(?, productName), 
             totalCost = ?, 
             paidToDate = ?, 
             pendingDue = ?, 
             status = ?, 
             paymentMethod = ?
         WHERE id = ? OR itemId = ? OR purchaseId = ?`,
        [sName || null, sPhone || null, sLoc || null, pName || null, total, paid, due, due === 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID'), pMethod, cleanId, cleanId, cleanId]
      );
    } catch (pcErr) {
      console.warn('[vendor-payment-ledger PUT purchase_credits sync warning]:', pcErr.message);
    }

    // 4. Dynamic sync to VendorPaymentLedger table
    let updatedLedger = null;
    try {
      const vplPayload = {
        supplierName: sName,
        supplierPhone: sPhone,
        supplierLocation: sLoc,
        productName: pName,
        category: cat,
        petisPurchased: qty,
        totalCost: total,
        amountPaid: paid,
        cashPaid: cash,
        bankPaid: bank,
        dueAmount: due,
        paymentMethod: pMethod,
        status: due === 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID')
      };
      updatedLedger = await VendorPaymentLedger.findByIdAndUpdate(id, vplPayload, { new: true });
      if (!updatedLedger && cleanId !== id) {
        updatedLedger = await VendorPaymentLedger.findByIdAndUpdate(cleanId, vplPayload, { new: true });
      }
    } catch (vplErr) {
      console.warn('[vendor-payment-ledger PUT VendorPaymentLedger sync warning]:', vplErr.message);
    }

    res.json({ success: true, message: 'Vendor bill updated dynamically across database', ledger: updatedLedger });
  } catch (err) {
    console.error('[vendor-payment-ledger PUT error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/vendor-payment-ledger/:id', authenticate, requireShopAdmin, async (req, res) => {
  const canDelete = await checkBranchApproval(req, 'delete', 'vendors');
  if (!canDelete) {
    return res.status(403).json({ message: "🔒 Super Admin Approval Required: Vendor bill delete is locked for this branch." });
  }
  try {
    const { id } = req.params;
    const cleanId = String(id).replace(/^vpl-/, '').replace(/^item-/, '');

    // 1. Delete from purchases in MySQL
    try {
      await pool.query('DELETE FROM purchases WHERE id = ? OR itemId = ?', [cleanId, cleanId]);
    } catch (pErr) {
      console.warn('[vendor-payment-ledger DELETE purchases warning]:', pErr.message);
    }

    // 2. Delete from purchase_credits in MySQL
    try {
      await pool.query('DELETE FROM purchase_credits WHERE id = ? OR itemId = ? OR purchaseId = ?', [cleanId, cleanId, cleanId]);
    } catch (pcErr) {
      console.warn('[vendor-payment-ledger DELETE purchase_credits warning]:', pcErr.message);
    }

    // 3. Delete from items if it was an item-only record
    try {
      if (String(id).startsWith('item-')) {
        await pool.query('DELETE FROM items WHERE id = ?', [cleanId]);
      }
    } catch (itErr) {
      console.warn('[vendor-payment-ledger DELETE items warning]:', itErr.message);
    }

    // 4. Delete from vendor_payment_ledger in MySQL
    try {
      await VendorPaymentLedger.findByIdAndDelete(id);
      if (cleanId !== id) {
        await VendorPaymentLedger.findByIdAndDelete(cleanId);
      }
      await pool.query('DELETE FROM vendor_payment_ledger WHERE id = ? OR purchaseId = ?', [cleanId, cleanId]);
    } catch (vplErr) {
      console.warn('[vendor-payment-ledger DELETE vendor_payment_ledger warning]:', vplErr.message);
    }

    res.json({ success: true, message: 'Vendor purchase bill deleted dynamically across database', deletedId: id });
  } catch (err) {
    console.error('[vendor-payment-ledger DELETE error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Approve or Reject Bank Transfer Sale
router.patch('/:id/approve', authenticate, requireShopAdmin, async (req, res) => {
  try {
    const { approvalStatus = 'APPROVED' } = req.body;
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    sale.approvalStatus = approvalStatus;
    await sale.save();
    res.json({ success: true, message: `Sale ${approvalStatus.toLowerCase()} successfully`, sale });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Helper logic for executing credit settlement
const processCreditSettlement = async (saleId, { paymentMethod = 'CASH', amountPaid, transactionId, paymentProof, paymentReceipt }, res) => {
  try {
    const sale = await Sale.findById(saleId);
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const currentDue = Number(sale.dueAmount) > 0 ? Number(sale.dueAmount) : Number(sale.totalAmount);
    const settleAmount = amountPaid ? Math.min(Number(amountPaid), currentDue) : currentDue;

    if (settleAmount <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount' });
    }

    const method = String(paymentMethod).toUpperCase();
    const isBank = method === 'BANK_TRANSFER' || method === 'BANK' || method === 'ONLINE' || method === 'EASYPAISA';

    if (isBank) {
      sale.bankPaid = (Number(sale.bankPaid) || 0) + settleAmount;
      if (transactionId) sale.transactionId = transactionId;
      if (paymentProof || paymentReceipt) {
        sale.paymentProof = paymentProof || paymentReceipt;
        sale.paymentReceipt = paymentProof || paymentReceipt;
      }
    } else {
      // CASH
      sale.cashPaid = (Number(sale.cashPaid) || 0) + settleAmount;
      
      // Update active CashSession
      const activeSession = await CashSession.findOne({ status: 'open' });
      if (activeSession) {
        activeSession.totalSales = (Number(activeSession.totalSales) || 0) + settleAmount;
        activeSession.expectedCash = (Number(activeSession.expectedCash) || 0) + settleAmount;
        await activeSession.save();
      }
    }

    const newDue = Math.max(0, currentDue - settleAmount);
    sale.dueAmount = newDue;
    sale.isCredit = newDue > 0;
    
    // If fully paid, update paymentMethod according to what was paid
    if (newDue === 0) {
      if ((Number(sale.bankPaid) || 0) > 0 && (Number(sale.cashPaid) || 0) === 0) {
        sale.paymentMethod = 'BANK_TRANSFER';
      } else if ((Number(sale.cashPaid) || 0) > 0 && (Number(sale.bankPaid) || 0) === 0) {
        sale.paymentMethod = 'CASH';
      } else if ((Number(sale.cashPaid) || 0) > 0 && (Number(sale.bankPaid) || 0) > 0) {
        sale.paymentMethod = 'SPLIT';
      } else {
        sale.paymentMethod = isBank ? 'BANK_TRANSFER' : 'CASH';
      }
    }

    const updatedSale = await Sale.findByIdAndUpdate(sale.id, sale, { new: true });

    // Also sync with customer_credits table in MySQL
    try {
      const mysqlModule = await import('../config/mysql.js');
      const pool = mysqlModule.default;
      const status = newDue <= 0 ? 'PAID' : ((Number(sale.cashPaid) || 0) + (Number(sale.bankPaid) || 0) > 0 ? 'PARTIAL' : 'UNPAID');
      
      const { ALL_BRANCH_PREFIXES } = await import('../models/dbHelper.js');
      for (const prefix of ALL_BRANCH_PREFIXES) {
        try {
          await pool.query(
            `UPDATE \`${prefix}__customer_credits\` SET paidAmount = ?, dueAmount = ?, status = ?, lastPaymentDate = NOW() WHERE saleId = ?`,
            [(Number(sale.cashPaid) || 0) + (Number(sale.bankPaid) || 0), newDue, status, sale.id]
          );
        } catch (e) { }
      }
    } catch (ccErr) { }

    // Also update Order if it corresponds to an order
    try {
      const order = await Order.findById(saleId);
      if (order) {
        if (newDue === 0) {
          order.paymentStatus = 'PAID';
        }
        order.paymentMethod = sale.paymentMethod;
        await Order.findByIdAndUpdate(order.id, order);
      }
    } catch (e) { }

    return res.json({
      success: true,
      message: `Credit of Rs. ${settleAmount.toLocaleString('en-PK')} settled via ${isBank ? 'Bank Transfer' : 'Cash'}`,
      sale: updatedSale || sale
    });
  } catch (err) {
    console.error('Settle credit error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// ── DEDICATED ROUTE 1: SETTLE CREDIT VIA CASH ──
router.patch('/:id/settle-cash', authenticate, requireShopAdmin, async (req, res) => {
  await processCreditSettlement(req.params.id, { ...req.body, paymentMethod: 'CASH' }, res);
});

// ── DEDICATED ROUTE 2: SETTLE CREDIT VIA BANK TRANSFER ──
router.patch('/:id/settle-bank', authenticate, requireShopAdmin, async (req, res) => {
  await processCreditSettlement(req.params.id, { ...req.body, paymentMethod: 'BANK_TRANSFER' }, res);
});

// ── UPDATE CUSTOMER DETAILS ACROSS SALES ──
router.put('/update-customer-info', async (req, res) => {
  try {
    const { saleIds, oldCustomerName, oldCustomerPhone, oldCustomerEmail, newCustomerName, newCustomerPhone, newCustomerEmail } = req.body;
    
    const updateFields = {};
    if (newCustomerName) updateFields.customerName = newCustomerName.trim();
    if (newCustomerPhone !== undefined) updateFields.customerPhone = newCustomerPhone.trim();
    if (newCustomerEmail !== undefined) updateFields.customerEmail = newCustomerEmail.trim().toLowerCase();

    const queryOr = [];
    if (Array.isArray(saleIds) && saleIds.length > 0) {
      queryOr.push({ _id: { $in: saleIds } });
    }
    if (oldCustomerName && oldCustomerName.trim()) {
      queryOr.push({ customerName: new RegExp(`^${oldCustomerName.trim()}$`, 'i') });
    }
    if (oldCustomerPhone && oldCustomerPhone.trim()) {
      queryOr.push({ customerPhone: oldCustomerPhone.trim() });
    }
    if (oldCustomerEmail && oldCustomerEmail.trim() && oldCustomerEmail !== 'physical store pos') {
      queryOr.push({ customerEmail: oldCustomerEmail.trim().toLowerCase() });
    }

    if (queryOr.length > 0) {
      await Sale.updateMany(
        { $or: queryOr },
        { $set: updateFields }
      );
      try {
        await CustomerPaymentLedger.updateMany(
          { $or: queryOr },
          { $set: updateFields }
        );
      } catch (cplErr) {
        console.warn('CustomerPaymentLedger update warning:', cplErr.message);
      }
    }

    res.json({ success: true, message: 'Customer details updated successfully across sales' });
  } catch (err) {
    console.error('Update sales customer info error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET CUSTOMER CREDITS FROM DATABASE ──
router.get('/customer-credits', authenticate, async (req, res) => {
  try {
    const rawShopId = req.query.shopId || req.user?.shopId;
    let query = {};
    if (rawShopId) {
      const targetShopId = await resolveShopId(rawShopId) || rawShopId;
      query.shopId = targetShopId;
    }
    const credits = await CustomerCredit.find(query);
    res.json(credits);
  } catch (error) {
    console.error('[getCustomerCredits error]', error);
    res.status(500).json({ message: error.message });
  }
});

// ── DELETE CUSTOMER CREDIT RECORD ──
router.delete('/customer-credit/:id', authenticate, requireShopAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const creditId = id || req.body?.id || req.body?.creditId || req.body?.saleId;
    if (!creditId || creditId === 'undefined' || creditId === 'null') {
      return res.status(400).json({ message: 'Valid ID is required' });
    }

    try {
      await CustomerCredit.findByIdAndDelete(creditId);
      await CustomerCredit.deleteMany({ saleId: creditId });
    } catch (ccErr) {
      console.error('[deleteCustomerCredit] CustomerCredit delete error:', ccErr.message);
    }

    res.json({ success: true, message: 'Customer credit record deleted successfully', deletedId: creditId });
  } catch (error) {
    console.error('[deleteCustomerCredit error]', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
