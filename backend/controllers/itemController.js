import Item, { getBranchItemModel, syncBranchProducts } from '../models/Item.js';
import Expense from '../models/Expense.js';
import Purchase from '../models/Purchase.js';
import PurchaseCredit from '../models/PurchaseCredit.js';
import Vendor from '../models/Vendor.js';
import VendorPaymentLedger from '../models/VendorPaymentLedger.js';
import pool from '../config/mysql.js';
import { BRANCH_TABLE_PREFIXES, ALL_BRANCH_PREFIXES } from '../models/dbHelper.js';
import { logSystemUpdate } from '../utils/updateHelper.js';
import { resolveShopId } from '../utils/shopResolver.js';

// @desc    Get all items (dynamically scoped per branch)
const getItems = async (req, res) => {
  try {
    const rawShopId = req.query.shopId || (req.user?.role !== 'super_admin' ? (req.user?.shopId?._id || req.user?.shopId) : null);
    let targetShopId = null;

    if (rawShopId) {
      targetShopId = await resolveShopId(rawShopId) || rawShopId;
    } else if (req.user?.shopId) {
      const userShop = req.user.shopId?._id || req.user.shopId;
      targetShopId = await resolveShopId(userShop) || userShop;
    }

    let items = [];
    if (targetShopId) {
      items = await Item.find({ shopId: targetShopId }).sort({ createdAt: -1 });
    } else {
      // Super Admin viewing global items across all shops
      items = await Item.find({}).sort({ createdAt: -1 });
    }

    const normalized = items.map(item => {
      const itemObj = typeof item.toObject === 'function' ? item.toObject() : { ...item };
      const pMethod = String(itemObj.paymentMethod || '').trim().toLowerCase();
      const isBankMethod = (
        pMethod.includes('bank') || pMethod.includes('easy') || pMethod.includes('jazz') || pMethod.includes('online') || pMethod.includes('cheque') || pMethod.includes('transfer') || pMethod.includes('card')
      );
      const isOnline = isBankMethod || itemObj.isOnlinePayment === true;
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
      const hasExplicitDue = itemObj.dueAmountToSupplier !== undefined && itemObj.dueAmountToSupplier !== null && Number(itemObj.dueAmountToSupplier) >= 0;

      if (hasExplicitDue || isCreditMethod) {
        const rawDue = hasExplicitDue ? Number(itemObj.dueAmountToSupplier) : itemObj.totalPurchaseCost;
        itemObj.dueAmountToSupplier = Math.min(itemObj.totalPurchaseCost, Math.max(0, rawDue));
        itemObj.amountPaidToSupplier = Math.max(0, itemObj.totalPurchaseCost - itemObj.dueAmountToSupplier);
      } else {
        // 100% Paid (No Credit)
        itemObj.amountPaidToSupplier = itemObj.totalPurchaseCost;
        itemObj.dueAmountToSupplier = 0;
      }

      // Separate Cash vs Bank
      let cashP = Number(itemObj.cashPaidToSupplier) || 0;
      let bankP = Number(itemObj.bankPaidToSupplier) || 0;
      if (cashP === 0 && bankP === 0 && itemObj.amountPaidToSupplier > 0) {
        if (isOnline) {
          bankP = itemObj.amountPaidToSupplier;
        } else {
          cashP = itemObj.amountPaidToSupplier;
        }
      }
      itemObj.cashPaidToSupplier = cashP;
      itemObj.bankPaidToSupplier = bankP;

      return itemObj;
    });
    res.json(normalized);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single item
const getItem = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const filter = (req.user?.role === 'super_admin' || !req.user?.shopId)
      ? { id }
      : { id, shopId: req.user.shopId };

    const item = await Item.findOne(filter);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new item
const createItem = async (req, res) => {
  try {
    let rawShopId = req.body.shopId || (req.user?.shopId?._id || req.user?.shopId) || req.query?.shopId || req.headers['x-shop-id'];
    const resolvedShopId = await resolveShopId(rawShopId);
    const shopId = resolvedShopId ? Number(resolvedShopId) : (rawShopId ? Number(rawShopId) : null);
    if (!shopId) {
      return res.status(400).json({ message: 'shopId is required to add a product' });
    }
    const finalImages = (req.body.images && req.body.images.length > 0) ? req.body.images : ['/egg2.png'];
    const pMethod = String(req.body.paymentMethod || '').trim().toLowerCase();
    const isBankMethod = (
      pMethod.includes('bank') || pMethod.includes('easy') || pMethod.includes('jazz') || pMethod.includes('online') || pMethod.includes('cheque') || pMethod.includes('transfer') || pMethod.includes('card')
    );
    const isOnline = isBankMethod || req.body.isOnlinePayment === true;

    const totalCost = Number(req.body.totalPurchaseCost || 0);
    const paidAmt = Number(req.body.amountPaidToSupplier || 0);
    const dueAmt = req.body.dueAmountToSupplier !== undefined 
      ? Number(req.body.dueAmountToSupplier)
      : Math.max(0, totalCost - paidAmt);

    const cashPaid = req.body.cashPaidToSupplier !== undefined ? Number(req.body.cashPaidToSupplier) : (isOnline ? 0 : paidAmt);
    const bankPaid = req.body.bankPaidToSupplier !== undefined ? Number(req.body.bankPaidToSupplier) : (isOnline ? paidAmt : 0);

    const newItemData = { 
      ...req.body, 
      images: finalImages, 
      shopId,
      isOnlinePayment: isOnline,
      totalPurchaseCost: totalCost,
      amountPaidToSupplier: paidAmt,
      cashPaidToSupplier: cashPaid,
      bankPaidToSupplier: bankPaid,
      dueAmountToSupplier: dueAmt
    };
    
    // Save to Item model
    const newItem = await Item.create(newItemData);
    
    // Auto-resolve or register Vendor ID
    let vendorId = req.body.vendorId || null;
    const sName = (newItem.supplierName || req.body.supplierName || '').trim();
    if (sName) {
      try {
        let v = await Vendor.findOne({ name: sName, shopId });
        if (!v) {
          v = await Vendor.findOne({ name: { $regex: sName } });
        }
        if (!v) {
          v = await Vendor.create({
            name: sName,
            phone: newItem.supplierPhone || req.body.supplierPhone || '03069578493',
            location: newItem.supplierLocation || req.body.supplierLocation || '',
            shopId
          });
        }
        if (v && v.id) {
          vendorId = v.id;
        }
      } catch (_) {}
    }

    // Auto-create purchase record in purchases table for this branch
    try {
      await Purchase.create({
        shopId: newItem.shopId,
        itemId: newItem.id,
        vendorId: vendorId || null,
        productName: newItem.name,
        supplierName: newItem.supplierName || sName || '',
        supplierPhone: newItem.supplierPhone || '',
        supplierLocation: newItem.supplierLocation || '',
        petiQuantity: Number(newItem.petiQuantity) || 0,
        trayQuantity: Number(newItem.trayQuantity) || 0,
        eggQuantity: Number(newItem.eggQuantity) || (Number(newItem.stock) || 0),
        unitType: newItem.unitType || 'peti',
        buyCost: Number(newItem.costPrice) || Number(newItem.price) || 0,
        totalCost: Number(newItem.totalPurchaseCost) || 0,
        paymentType: newItem.paymentMethod || 'Cash',
        amountPaid: Number(newItem.amountPaidToSupplier) || 0,
        dueAmount: Number(newItem.dueAmountToSupplier) || 0,
        paymentReceipt: newItem.paymentReceipt || '',
        notes: `Purchase Restock: ${newItem.name}`
      });
    } catch (purchErr) {
      console.error('[createItem] Purchase record creation failed:', purchErr.message);
    }

    // Auto-create purchase_credits record if there is due balance for supplier
    if (Number(newItem.dueAmountToSupplier) > 0) {
      try {
        await PurchaseCredit.create({
          shopId: newItem.shopId,
          itemId: newItem.id,
          vendorId: vendorId || null,
          productName: newItem.name,
          supplierName: newItem.supplierName || sName || 'Egg Supplier',
          supplierPhone: newItem.supplierPhone || '',
          supplierLocation: newItem.supplierLocation || '',
          quantityText: [
            newItem.petiQuantity > 0 ? `${newItem.petiQuantity} Boxes` : '',
            newItem.trayQuantity > 0 ? `${newItem.trayQuantity} Packs` : '',
            newItem.eggQuantity > 0 ? `${newItem.eggQuantity} Pieces` : ''
          ].filter(Boolean).join(', ') || '0',
          totalCost: Number(newItem.totalPurchaseCost) || 0,
          paidToDate: Number(newItem.amountPaidToSupplier) || 0,
          pendingDue: Number(newItem.dueAmountToSupplier) || 0,
          status: Number(newItem.amountPaidToSupplier) > 0 ? 'PARTIAL' : 'UNPAID',
          paymentMethod: newItem.paymentMethod || 'Credit',
          paymentReceipt: newItem.paymentReceipt || ''
        });
      } catch (pcErr) {
        console.error('[createItem] Purchase Credit record creation failed:', pcErr.message);
      }
    }

    // Log system update for new product
    await logSystemUpdate(
      "New Features", 
      "zap", 
      `New Product deployed: ${newItem.name} (${newItem.category})`
    );

    res.status(201).json(newItem);
  } catch (error) {
    console.error('[createItem error]', error.message);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update item
const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const updateData = { ...req.body };
    const pMethod = String(req.body.paymentMethod || '').trim().toLowerCase();
    const isBankMethod = (
      pMethod.includes('bank') || pMethod.includes('easy') || pMethod.includes('jazz') || pMethod.includes('online') || pMethod.includes('cheque') || pMethod.includes('transfer') || pMethod.includes('card')
    );
    const isOnline = isBankMethod || req.body.isOnlinePayment === true;
    updateData.isOnlinePayment = isOnline;

    if (req.body.totalPurchaseCost !== undefined || req.body.amountPaidToSupplier !== undefined || req.body.dueAmountToSupplier !== undefined) {
      const totalCost = Number(req.body.totalPurchaseCost || 0);
      const paidAmt = Number(req.body.amountPaidToSupplier || 0);
      const dueAmt = req.body.dueAmountToSupplier !== undefined 
        ? Number(req.body.dueAmountToSupplier)
        : Math.max(0, totalCost - paidAmt);

      updateData.totalPurchaseCost = totalCost;
      updateData.amountPaidToSupplier = paidAmt;
      updateData.dueAmountToSupplier = dueAmt;

      if (req.body.cashPaidToSupplier !== undefined || req.body.bankPaidToSupplier !== undefined) {
        updateData.cashPaidToSupplier = Number(req.body.cashPaidToSupplier) || 0;
        updateData.bankPaidToSupplier = Number(req.body.bankPaidToSupplier) || 0;
      } else {
        updateData.cashPaidToSupplier = isOnline ? 0 : paidAmt;
        updateData.bankPaidToSupplier = isOnline ? paidAmt : 0;
      }
    }

    if (req.body.images !== undefined) {
      if (Array.isArray(req.body.images) && req.body.images.length > 0 && req.body.images[0]) {
        updateData.images = req.body.images;
      } else if (typeof req.body.images === 'string' && req.body.images.trim()) {
        updateData.images = [req.body.images.trim()];
      } else {
        const existing = await Item.findById(id);
        updateData.images = (existing?.images && existing.images.length > 0 && existing.images[0]) ? existing.images : ['/egg2.png'];
      }
    }

    const existing = await Item.findById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Product not found in database' });
    }

    const updatedItem = await Item.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    if (!updatedItem) return res.status(404).json({ message: 'Failed to update product in database' });

    // Also sync updates to purchases and purchase_credits tables in MySQL if relevant
    try {
      if (updateData.name || updateData.price !== undefined || updateData.costPrice !== undefined || updateData.stock !== undefined) {
        await pool.query(
          'UPDATE purchases SET name = COALESCE(?, name), price = COALESCE(?, price), costPrice = COALESCE(?, costPrice), quantity = COALESCE(?, quantity) WHERE itemId = ? OR id = ?',
          [updateData.name || null, updateData.price !== undefined ? updateData.price : null, updateData.costPrice !== undefined ? updateData.costPrice : null, updateData.stock !== undefined ? updateData.stock : null, id, id]
        );
      }
    } catch (pSyncErr) {
      console.error('[updateItem] purchases sync error:', pSyncErr.message);
    }

    // Also sync to dynamic VendorPaymentLedger branch table
    try {
      const vplUp = {};
      if (updateData.supplierName !== undefined) vplUp.supplierName = updateData.supplierName;
      if (updateData.supplierPhone !== undefined) vplUp.supplierPhone = updateData.supplierPhone;
      if (updateData.name !== undefined) vplUp.productName = updateData.name;
      if (updateData.category !== undefined) vplUp.category = updateData.category;
      if (updateData.petiQuantity !== undefined) vplUp.petisPurchased = Number(updateData.petiQuantity) || 0;
      if (updateData.totalPurchaseCost !== undefined) vplUp.totalCost = Number(updateData.totalPurchaseCost);
      if (updateData.amountPaidToSupplier !== undefined) vplUp.amountPaid = Number(updateData.amountPaidToSupplier);
      if (updateData.cashPaidToSupplier !== undefined) vplUp.cashPaid = Number(updateData.cashPaidToSupplier);
      if (updateData.bankPaidToSupplier !== undefined) vplUp.bankPaid = Number(updateData.bankPaidToSupplier);
      if (updateData.dueAmountToSupplier !== undefined) {
        vplUp.dueAmount = Number(updateData.dueAmountToSupplier);
        vplUp.status = vplUp.dueAmount === 0 ? 'PAID' : 'PARTIAL';
      }
      if (Object.keys(vplUp).length > 0) {
        await VendorPaymentLedger.findByIdAndUpdate(`vpl-${id}`, vplUp);
        await VendorPaymentLedger.findOneAndUpdate({ purchaseId: String(id) }, vplUp);
      }
    } catch (vplSyncErr) {
      console.warn('VendorPaymentLedger sync warning:', vplSyncErr.message);
    }

    res.json(updatedItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete item & sync deletion with purchase_credits and purchases tables
const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const item = await Item.findByIdAndDelete(id);

    // Also delete from purchase_credits and purchases tables in MySQL
    try {
      await PurchaseCredit.findByIdAndDelete(id);
      await PurchaseCredit.deleteMany({ itemId: id });
    } catch (pcErr) {
      console.error('[deleteItem] purchase_credits delete error:', pcErr.message);
    }

    try {
      await Purchase.findByIdAndDelete(id);
      await Purchase.deleteMany({ itemId: id });
      await pool.query('DELETE FROM purchases WHERE itemId = ? OR id = ?', [id, id]);
    } catch (pErr) {
      console.error('[deleteItem] purchases delete error:', pErr.message);
    }

    // Also delete from VendorPaymentLedger branch table
    try {
      await VendorPaymentLedger.findByIdAndDelete(id);
      await VendorPaymentLedger.findByIdAndDelete(`vpl-${id}`);
      await VendorPaymentLedger.deleteMany({ purchaseId: String(id) });
    } catch (_) {}

    try {
      await pool.query('DELETE FROM damaged_products WHERE itemId = ?', [id]);
    } catch (_) {}

    res.json({ message: 'Item and purchase credit records deleted successfully from database', deletedId: id, existed: !!item });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete Purchase Credit record directly
const deletePurchaseCredit = async (req, res) => {
  try {
    const { id } = req.params;
    const creditId = id || req.body?.id || req.body?.creditId || req.body?.itemId;
    if (!creditId || creditId === 'undefined' || creditId === 'null') {
      return res.status(400).json({ message: 'Valid ID is required' });
    }

    // Delete from purchase_credits branch tables
    try {
      await PurchaseCredit.findByIdAndDelete(creditId);
      await PurchaseCredit.deleteMany({ itemId: creditId });
      await PurchaseCredit.deleteMany({ purchaseId: creditId });
    } catch (pcErr) {
      console.error('[deletePurchaseCredit] purchase_credits table delete error:', pcErr.message);
    }

    // Also delete from purchases and items if matching
    try {
      await Purchase.findByIdAndDelete(creditId);
      await Purchase.deleteMany({ itemId: creditId });
      await pool.query('DELETE FROM purchases WHERE id = ? OR itemId = ?', [creditId, creditId]);
    } catch (_) {}

    try {
      await Item.findByIdAndDelete(creditId);
      await pool.query('DELETE FROM items WHERE id = ?', [creditId]);
    } catch (_) {}

    // Also delete from VendorPaymentLedger branch table
    try {
      await VendorPaymentLedger.findByIdAndDelete(creditId);
      await VendorPaymentLedger.findByIdAndDelete(`vpl-${creditId}`);
      await VendorPaymentLedger.deleteMany({ purchaseId: String(creditId) });
    } catch (_) {}

    res.json({ success: true, message: 'Purchase credit record deleted successfully from database', deletedId: creditId });
  } catch (error) {
    console.error('[deletePurchaseCredit error]', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Settle Supplier Credit (Due) via Cash or Bank Transfer
const settleSupplierCredit = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ message: 'Invalid product or credit ID' });
    }

    const { paymentMethod = 'Cash', amountPaid, paymentReceipt, cashAmount, bankAmount } = req.body;

    // 1. Search in Item by id
    let item = await Item.findById(id);

    // 2. If not found by direct id, check if id is a PurchaseCredit record ID or itemId
    let pcRecord = null;
    if (!item) {
      pcRecord = await PurchaseCredit.findById(id);
      if (!pcRecord) {
        pcRecord = await PurchaseCredit.findOne({ itemId: id });
      }
      if (pcRecord && pcRecord.itemId) {
        item = await Item.findById(pcRecord.itemId);
      }
    } else {
      pcRecord = await PurchaseCredit.findOne({ itemId: item.id });
    }

    if (!item && !pcRecord) {
      return res.status(404).json({ message: 'Product or Credit Record not found' });
    }

    const isSplit = String(paymentMethod).toLowerCase().includes('split');
    const isBank = !isSplit && (String(paymentMethod).toLowerCase().includes('bank') || String(paymentMethod).toLowerCase().includes('online') || String(paymentMethod).toLowerCase().includes('transfer'));
    const isCredit = !isSplit && String(paymentMethod).toLowerCase().includes('credit');

    // Case A: If matching Item exists
    if (item) {
      const unitCost = Number(item.costPrice) > 0 ? Number(item.costPrice) : Number(item.price || 0);
      const unitDivisor = item.unitType === 'egg' ? 1 : item.unitType === 'tray' ? 30 : 360;
      const petiQty = Number(item.petiQuantity) || 0;
      const stockEggs = Number(item.stock) || 0;

      const totalCost = Number(item.totalPurchaseCost) > 0
        ? Number(item.totalPurchaseCost)
        : (petiQty > 0 ? petiQty * unitCost : (stockEggs > 0 ? stockEggs * (unitCost / unitDivisor) : 0));

      const explicitDue = (item.dueAmountToSupplier !== undefined && item.dueAmountToSupplier !== null)
        ? Number(item.dueAmountToSupplier)
        : null;

      const currentDue = (explicitDue !== null)
        ? explicitDue
        : (pcRecord ? Number(pcRecord.pendingDue || 0) : Math.max(0, totalCost - (Number(item.amountPaidToSupplier) || 0)));

      let payAmt = Number(amountPaid);
      if (isSplit) {
        const cAmt = Number(cashAmount) || 0;
        const bAmt = Number(bankAmount) || 0;
        payAmt = cAmt + bAmt;
      } else if (isNaN(payAmt) || payAmt <= 0) {
        payAmt = currentDue > 0 ? currentDue : 0;
      }
      if (payAmt <= 0) {
        return res.status(400).json({ message: 'Invalid payment amount' });
      }

      const effectiveDue = currentDue > 0 ? currentDue : payAmt;
      const newDue = Math.max(0, effectiveDue - payAmt);
      const newPaid = (Number(item.amountPaidToSupplier) || 0) + payAmt;

      const updatePayload = {
        dueAmountToSupplier: newDue,
        amountPaidToSupplier: newPaid,
        totalPurchaseCost: Math.max(totalCost, newPaid + newDue),
        lastUpdated: new Date().toISOString().split('T')[0]
      };

      if (isSplit) {
        const cAmt = Number(cashAmount) || 0;
        const bAmt = Number(bankAmount) || 0;
        updatePayload.cashPaidToSupplier = (Number(item.cashPaidToSupplier) || 0) + cAmt;
        updatePayload.bankPaidToSupplier = (Number(item.bankPaidToSupplier) || 0) + bAmt;
        updatePayload.isOnlinePayment = bAmt > 0;
        if (paymentReceipt) updatePayload.paymentReceipt = paymentReceipt;
        updatePayload.paymentMethod = 'Split';
      } else if (isBank) {
        updatePayload.bankPaidToSupplier = (Number(item.bankPaidToSupplier) || 0) + payAmt;
        updatePayload.isOnlinePayment = true;
        if (paymentReceipt) updatePayload.paymentReceipt = paymentReceipt;
        updatePayload.paymentMethod = 'Bank Transfer';
      } else if (isCredit) {
        updatePayload.isOnlinePayment = false;
        if (paymentReceipt) updatePayload.paymentReceipt = paymentReceipt;
        updatePayload.paymentMethod = 'Credit';
      } else {
        updatePayload.cashPaidToSupplier = (Number(item.cashPaidToSupplier) || 0) + payAmt;
        if ((Number(item.bankPaidToSupplier) || 0) === 0) {
          updatePayload.isOnlinePayment = false;
          updatePayload.paymentMethod = 'Cash';
        }
      }

      const updatedItem = await Item.findByIdAndUpdate(item.id, updatePayload);
      const pcStatus = newDue <= 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');

      // Sync across branch tables
      try {
        await PurchaseCredit.findOneAndUpdate(
          { itemId: item.id },
          { paidToDate: newPaid, pendingDue: newDue, status: pcStatus, lastSettlementDate: new Date() }
        );
        await PurchaseCredit.findOneAndUpdate(
          { id: id },
          { paidToDate: newPaid, pendingDue: newDue, status: pcStatus, lastSettlementDate: new Date() }
        );

        const { ALL_BRANCH_PREFIXES } = await import('../models/dbHelper.js');
        for (const prefix of ALL_BRANCH_PREFIXES) {
          try {
            await pool.query(
              `UPDATE \`${prefix}__purchase_credits\` SET paidToDate = ?, pendingDue = ?, status = ?, lastSettlementDate = NOW() WHERE itemId = ? OR id = ?`,
              [newPaid, newDue, pcStatus, item.id, id]
            );
            await pool.query(
              `UPDATE \`${prefix}__purchases\` SET amountPaid = ?, dueAmount = ?, updatedAt = NOW() WHERE itemId = ? OR id = ?`,
              [newPaid, newDue, item.id, id]
            );
          } catch (_) {}
        }
      } catch (pcErr) {}

      return res.json({
        success: true,
        message: `Supplier Credit of Rs. ${payAmt.toLocaleString('en-PK')} paid via ${isSplit ? 'Split Payment' : isBank ? 'Bank Transfer' : isCredit ? 'Credit' : 'Cash'}`,
        item: updatedItem
      });
    }

    // Case B: If only pcRecord exists
    if (pcRecord) {
      const currentPaid = Number(pcRecord.paidToDate || 0);
      const currentDue = Number(pcRecord.pendingDue || 0);
      let payAmt = Number(amountPaid);
      if (isSplit) {
        const cAmt = Number(cashAmount) || 0;
        const bAmt = Number(bankAmount) || 0;
        payAmt = cAmt + bAmt;
      } else if (isNaN(payAmt) || payAmt <= 0) {
        payAmt = currentDue > 0 ? currentDue : 0;
      }
      if (payAmt <= 0) {
        return res.status(400).json({ message: 'Invalid payment amount' });
      }

      const newDue = Math.max(0, currentDue - payAmt);
      const newPaid = currentPaid + payAmt;
      const pcStatus = newDue <= 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');

      await PurchaseCredit.findByIdAndUpdate(pcRecord.id, {
        paidToDate: newPaid,
        pendingDue: newDue,
        status: pcStatus,
        lastSettlementDate: new Date()
      });

      const { ALL_BRANCH_PREFIXES } = await import('../models/dbHelper.js');
      for (const prefix of ALL_BRANCH_PREFIXES) {
        try {
          await pool.query(
            `UPDATE \`${prefix}__purchase_credits\` SET paidToDate = ?, pendingDue = ?, status = ?, lastSettlementDate = NOW() WHERE id = ? OR itemId = ?`,
            [newPaid, newDue, pcStatus, pcRecord.id, pcRecord.itemId || id]
          );
        } catch (_) {}
      }

      return res.json({
        success: true,
        message: `Supplier Credit of Rs. ${payAmt.toLocaleString('en-PK')} paid via ${isBank ? 'Bank Transfer' : 'Cash'}`,
        pcRecord
      });
    }
  } catch (error) {
    console.error('[settleSupplierCredit error]', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all registered Vendors / Suppliers (dynamically scoped per branch)
const getVendors = async (req, res) => {
  try {
    const rawShopId = req.query.shopId || (req.user?.role !== 'super_admin' ? (req.user?.shopId?._id || req.user?.shopId) : null);
    let targetShopId = null;
    if (rawShopId) {
      targetShopId = await resolveShopId(rawShopId) || rawShopId;
    }
    const numShopId = targetShopId ? Number(targetShopId) : null;

    let vendors = [];
    if (numShopId && BRANCH_TABLE_PREFIXES[numShopId]) {
      const branchPrefix = BRANCH_TABLE_PREFIXES[numShopId];
      const branchTable = `${branchPrefix}__vendors`;
      const [rows] = await pool.query(
        `SELECT * FROM \`${branchTable}\` ORDER BY name ASC`
      );
      vendors = rows;

      // Also include any distinct suppliers from this branch's items table that may not be in branch vendors table
      try {
        const itemTable = `${branchPrefix}__items`;
        const [itemSuppliers] = await pool.query(
          `SELECT DISTINCT supplierName as name, supplierPhone as phone, supplierLocation as location FROM \`${itemTable}\` WHERE supplierName IS NOT NULL AND TRIM(supplierName) != ""`
        );
        const existingNames = new Set(vendors.map(v => (v.name || '').toLowerCase().trim()));
        for (const s of itemSuppliers) {
          if (s.name && !existingNames.has(s.name.toLowerCase().trim())) {
            vendors.push({
              id: 'legacy_' + s.name.trim(),
              shopId: numShopId,
              name: s.name.trim(),
              phone: s.phone || '',
              location: s.location || '',
              farmLocation: s.location || '',
              status: 'active'
            });
            existingNames.add(s.name.toLowerCase().trim());
          }
        }
      } catch (_) {}
    } else {
      // Super Admin: query all 3 branch tables and merge
      const unionParts = ALL_BRANCH_PREFIXES.map(p => `SELECT * FROM \`${p}__vendors\``);
      const [rows] = await pool.query(`(${unionParts.join(' UNION ALL ')}) ORDER BY name ASC`);
      vendors = rows;
    }

    res.json(vendors);
  } catch (error) {
    console.error('[getVendors error]', error);
    res.status(500).json({ message: error.message });
  }
};

// Helper to inspect table columns dynamically so queries never fail on missing optional columns (e.g. farmLocation on live DB)
const getVendorTableColumns = async (tableName) => {
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
    return new Set(cols.map(c => c.Field.toLowerCase()));
  } catch (e) {
    return new Set(['id', 'shopid', 'name', 'phone', 'location', 'status']);
  }
};

// @desc    Create a new Vendor for a specific branch
const createVendor = async (req, res) => {
  try {
    const { name, phone, location, farmLocation, email, notes, shopId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Vendor / Farm name is required' });
    }
    const rawShopId = shopId || req.user?.shopId || 1;
    const resolved = await resolveShopId(rawShopId) || rawShopId;
    const targetShopId = Number(resolved) || 1;
    const branchPrefix = BRANCH_TABLE_PREFIXES[targetShopId] || 'peshawar_branch';
    const targetTable = `${branchPrefix}__vendors`;

    const vName = name.trim();
    const vPhone = (phone || '').trim();
    const vLoc = (location || farmLocation || '').trim();
    const vEmail = (email || '').trim();
    const vNotes = (notes || '').trim();

    // Dynamically check columns to support all live & local database schemas
    const cols = await getVendorTableColumns(targetTable);

    // Check if vendor already exists in this branch's vendor table
    const [existing] = await pool.query(
      `SELECT * FROM \`${targetTable}\` WHERE LOWER(name) = LOWER(?)`,
      [vName]
    );

    if (existing.length > 0) {
      const updates = [];
      const values = [];

      if (cols.has('phone')) {
        updates.push("phone = COALESCE(NULLIF(?, ''), phone)");
        values.push(vPhone);
      }
      if (cols.has('location')) {
        updates.push("location = COALESCE(NULLIF(?, ''), location)");
        values.push(vLoc);
      }
      if (cols.has('farmlocation')) {
        updates.push("farmLocation = COALESCE(NULLIF(?, ''), farmLocation)");
        values.push(vLoc);
      }
      if (cols.has('email')) {
        updates.push("email = COALESCE(NULLIF(?, ''), email)");
        values.push(vEmail);
      }
      if (cols.has('notes')) {
        updates.push("notes = COALESCE(NULLIF(?, ''), notes)");
        values.push(vNotes);
      }
      if (cols.has('updatedat')) {
        updates.push("updatedAt = NOW()");
      }

      if (updates.length > 0) {
        values.push(existing[0].id);
        await pool.query(
          `UPDATE \`${targetTable}\` SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
      }

      const [updated] = await pool.query(`SELECT * FROM \`${targetTable}\` WHERE id = ?`, [existing[0].id]);
      const resVendor = updated[0] || {};
      resVendor.farmLocation = resVendor.farmLocation || resVendor.location || vLoc;
      resVendor.location = resVendor.location || vLoc;
      return res.status(200).json({
        message: 'Vendor already exists in this branch and details updated',
        vendor: resVendor
      });
    }

    const insertCols = ['name'];
    const insertPlaceholders = ['?'];
    const insertVals = [vName];

    if (cols.has('shopid')) {
      insertCols.push('shopId');
      insertPlaceholders.push('?');
      insertVals.push(targetShopId);
    }
    if (cols.has('phone')) {
      insertCols.push('phone');
      insertPlaceholders.push('?');
      insertVals.push(vPhone);
    }
    if (cols.has('location')) {
      insertCols.push('location');
      insertPlaceholders.push('?');
      insertVals.push(vLoc);
    }
    if (cols.has('farmlocation')) {
      insertCols.push('farmLocation');
      insertPlaceholders.push('?');
      insertVals.push(vLoc);
    }
    if (cols.has('email')) {
      insertCols.push('email');
      insertPlaceholders.push('?');
      insertVals.push(vEmail);
    }
    if (cols.has('notes')) {
      insertCols.push('notes');
      insertPlaceholders.push('?');
      insertVals.push(vNotes);
    }
    if (cols.has('status')) {
      insertCols.push('status');
      insertPlaceholders.push("'active'");
    }
    if (cols.has('isactive')) {
      insertCols.push('isActive');
      insertPlaceholders.push("1");
    }
    if (cols.has('createdat')) {
      insertCols.push('createdAt');
      insertPlaceholders.push("NOW()");
    }
    if (cols.has('updatedat')) {
      insertCols.push('updatedAt');
      insertPlaceholders.push("NOW()");
    }

    const [result] = await pool.query(
      `INSERT INTO \`${targetTable}\` (${insertCols.map(c => `\`${c}\``).join(', ')})
       VALUES (${insertPlaceholders.join(', ')})`,
      insertVals
    );

    const [newVendor] = await pool.query(`SELECT * FROM \`${targetTable}\` WHERE id = ?`, [result.insertId]);
    const resVendor = newVendor[0] || {};
    resVendor.farmLocation = resVendor.farmLocation || resVendor.location || vLoc;
    resVendor.location = resVendor.location || vLoc;

    return res.status(201).json({
      message: 'Vendor created successfully in branch',
      vendor: resVendor
    });
  } catch (error) {
    console.error('[createVendor error]', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update Vendor / Supplier details across branch tables
const updateVendor = async (req, res) => {
  try {
    const { oldName, name, phone, location, email, notes, shopId } = req.body;
    const rawShopId = shopId || req.user?.shopId || null;
    const resolved = rawShopId ? (await resolveShopId(rawShopId) || rawShopId) : null;
    const targetShopId = resolved ? Number(resolved) : null;

    if (!oldName && !name) {
      return res.status(400).json({ message: 'Vendor name is required' });
    }

    const currentName = (oldName || name || '').trim();
    const newName = (name || oldName || '').trim();
    const newPhone = (phone || '').trim();
    const newLocation = (location || '').trim();

    const targetPrefixes = (targetShopId && BRANCH_TABLE_PREFIXES[targetShopId])
      ? [BRANCH_TABLE_PREFIXES[targetShopId]]
      : ALL_BRANCH_PREFIXES;

    for (const prefix of targetPrefixes) {
      const vTable = `${prefix}__vendors`;
      const iTable = `${prefix}__items`;
      const pTable = `${prefix}__purchases`;
      const pcTable = `${prefix}__purchase_credits`;

      // 1. Update/Upsert in branch vendors table
      try {
        const vCols = await getVendorTableColumns(vTable);
        const [existingVendors] = await pool.query(
          `SELECT * FROM \`${vTable}\` WHERE LOWER(name) = LOWER(?) OR LOWER(name) = LOWER(?)`,
          [currentName, newName]
        );

        if (existingVendors.length > 0) {
          const upCols = [];
          const upVals = [];
          if (vCols.has('name')) { upCols.push('name = ?'); upVals.push(newName); }
          if (vCols.has('phone')) { upCols.push('phone = ?'); upVals.push(newPhone); }
          if (vCols.has('location')) { upCols.push('location = ?'); upVals.push(newLocation); }
          if (vCols.has('farmlocation')) { upCols.push('farmLocation = ?'); upVals.push(newLocation); }
          if (vCols.has('email')) { upCols.push('email = COALESCE(?, email)'); upVals.push(email || null); }
          if (vCols.has('notes')) { upCols.push('notes = COALESCE(?, notes)'); upVals.push(notes || null); }
          if (vCols.has('updatedat')) { upCols.push('updatedAt = NOW()'); }

          if (upCols.length > 0) {
            upVals.push(currentName, newName);
            await pool.query(
              `UPDATE \`${vTable}\` SET ${upCols.join(', ')} WHERE LOWER(name) = LOWER(?) OR LOWER(name) = LOWER(?)`,
              upVals
            );
          }
        } else if (targetShopId) {
          const insCols = ['name'];
          const insPlaceholders = ['?'];
          const insVals = [newName];

          if (vCols.has('shopid')) { insCols.push('shopId'); insPlaceholders.push('?'); insVals.push(targetShopId); }
          if (vCols.has('phone')) { insCols.push('phone'); insPlaceholders.push('?'); insVals.push(newPhone); }
          if (vCols.has('location')) { insCols.push('location'); insPlaceholders.push('?'); insVals.push(newLocation); }
          if (vCols.has('farmlocation')) { insCols.push('farmLocation'); insPlaceholders.push('?'); insVals.push(newLocation); }
          if (vCols.has('email')) { insCols.push('email'); insPlaceholders.push('?'); insVals.push(email || ''); }
          if (vCols.has('notes')) { insCols.push('notes'); insPlaceholders.push('?'); insVals.push(notes || ''); }
          if (vCols.has('status')) { insCols.push('status'); insPlaceholders.push("'active'"); }
          if (vCols.has('isactive')) { insCols.push('isActive'); insPlaceholders.push("1"); }
          if (vCols.has('createdat')) { insCols.push('createdAt'); insPlaceholders.push("NOW()"); }
          if (vCols.has('updatedat')) { insCols.push('updatedAt'); insPlaceholders.push("NOW()"); }

          await pool.query(
            `INSERT INTO \`${vTable}\` (${insCols.map(c => `\`${c}\``).join(', ')})
             VALUES (${insPlaceholders.join(', ')})`,
            insVals
          );
        }
      } catch (vErr) {
        console.error(`[updateVendor] ${vTable} error:`, vErr.message);
      }

      // 2. Update branch items table
      try {
        await pool.query(
          `UPDATE \`${iTable}\` 
           SET supplierName = ?, supplierPhone = ?, supplierLocation = ?, updatedAt = NOW() 
           WHERE supplierName = ? OR supplierName = ?`,
          [newName, newPhone, newLocation, currentName, newName]
        );
      } catch (_) {}

      // 3. Update branch purchases table
      try {
        await pool.query(
          `UPDATE \`${pTable}\` 
           SET supplierName = ?, supplierPhone = ?, supplierLocation = ?, updatedAt = NOW() 
           WHERE supplierName = ? OR supplierName = ?`,
          [newName, newPhone, newLocation, currentName, newName]
        );
      } catch (_) {}

      // 4. Update branch purchase_credits table
      try {
        await pool.query(
          `UPDATE \`${pcTable}\` 
           SET supplierName = ?, supplierPhone = ?, supplierLocation = ?, updatedAt = NOW() 
           WHERE supplierName = ? OR supplierName = ?`,
          [newName, newPhone, newLocation, currentName, newName]
        );
      } catch (_) {}
    }

    res.json({
      success: true,
      message: `Vendor "${newName}" updated successfully!`,
      vendor: {
        name: newName,
        phone: newPhone,
        location: newLocation
      }
    });
  } catch (error) {
    console.error('[updateVendor error]', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete Vendor and associated records across branch tables
const deleteVendor = async (req, res) => {
  try {
    const { name, shopId } = req.body;
    const rawShopId = shopId || req.user?.shopId || null;
    const resolved = rawShopId ? (await resolveShopId(rawShopId) || rawShopId) : null;
    const targetShopId = resolved ? Number(resolved) : null;

    if (!name) {
      return res.status(400).json({ message: 'Vendor name is required' });
    }

    const vendorName = String(name).trim();
    const targetPrefixes = (targetShopId && BRANCH_TABLE_PREFIXES[targetShopId])
      ? [BRANCH_TABLE_PREFIXES[targetShopId]]
      : ALL_BRANCH_PREFIXES;

    for (const prefix of targetPrefixes) {
      const vTable = `${prefix}__vendors`;
      const iTable = `${prefix}__items`;
      const pTable = `${prefix}__purchases`;
      const pcTable = `${prefix}__purchase_credits`;

      // 1. Delete from branch vendors table
      try {
        await pool.query(`DELETE FROM \`${vTable}\` WHERE LOWER(name) = LOWER(?)`, [vendorName]);
      } catch (vErr) {
        console.error(`[deleteVendor] ${vTable} error:`, vErr.message);
      }

      // 2. Delete / Unassign from branch items table
      try {
        await pool.query(`DELETE FROM \`${iTable}\` WHERE LOWER(supplierName) = LOWER(?)`, [vendorName]);
      } catch (_) {}

      // 3. Delete from branch purchases table
      try {
        await pool.query(`DELETE FROM \`${pTable}\` WHERE LOWER(supplierName) = LOWER(?)`, [vendorName]);
      } catch (_) {}

      // 4. Delete from branch purchase_credits table
      try {
        await pool.query(`DELETE FROM \`${pcTable}\` WHERE LOWER(supplierName) = LOWER(?)`, [vendorName]);
      } catch (_) {}
    }

    res.json({
      success: true,
      message: `Vendor "${vendorName}" and associated purchase records deleted successfully!`,
      deletedVendor: vendorName
    });
  } catch (error) {
    console.error('[deleteVendor error]', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all purchase credits
const getPurchaseCredits = async (req, res) => {
  try {
    const rawShopId = req.query.shopId || (req.user?.role !== 'super_admin' ? (req.user?.shopId?._id || req.user?.shopId) : null);
    let targetShopId = null;
    if (rawShopId) {
      targetShopId = await resolveShopId(rawShopId) || rawShopId;
    }
    let query = {};
    if (targetShopId) query.shopId = targetShopId;
    const credits = await PurchaseCredit.find(query);

    const enriched = (credits || []).map(c => {
      let petis = Number(c.petisPurchased || c.petiQuantity || c.petisCount || 0);
      let trays = Number(c.trayQuantity || c.traysCount || 0);
      let eggs = Number(c.eggQuantity || c.totalEggsCount || 0);

      const qText = String(c.quantityText || c.notes || c.productName || '');
      if (qText) {
        const pMatch = qText.match(/(\d+(?:\.\d+)?)\s*(?:peti|petis|box|boxes|p\b)/i);
        const tMatch = qText.match(/(\d+(?:\.\d+)?)\s*(?:tray|trays|t\b)/i);
        const eMatch = qText.match(/([\d,]+(?:\.\d+)?)\s*(?:egg|eggs|e\b|stock)/i);
        if (pMatch && !petis) petis = parseFloat(pMatch[1]);
        if (tMatch && !trays) trays = parseFloat(tMatch[1]);
        if (eMatch && !eggs) eggs = parseFloat(eMatch[1].replace(/,/g, ''));
      }

      if (petis > 0 && trays === 0) trays = Math.round(petis * 12);
      if (petis > 0 && eggs === 0) eggs = Math.round(petis * 360);
      if (trays > 0 && eggs === 0) eggs = Math.round(trays * 30);
      if (eggs > 0 && petis === 0) petis = Number((eggs / 360).toFixed(2));
      if (eggs > 0 && trays === 0) trays = Math.round(eggs / 30);

      return {
        ...c,
        petisPurchased: petis,
        petiQuantity: petis,
        petisCount: petis,
        trayQuantity: trays,
        traysCount: trays,
        eggQuantity: eggs,
        totalEggsCount: eggs
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('[getPurchaseCredits error]', error);
    res.status(500).json({ message: error.message });
  }
};

export {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  settleSupplierCredit,
  updateVendor,
  deleteVendor,
  deletePurchaseCredit,
  getPurchaseCredits,
  getVendors,
  createVendor
};
