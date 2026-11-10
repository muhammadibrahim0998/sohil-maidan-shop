import express from 'express';
import DamagedProduct from '../models/DamagedProduct.js';
import Item from '../models/Item.js';
import { resolveShopId } from '../utils/shopResolver.js';

const router = express.Router();

// Helper to reliably find an Item by productId (number or string) or productName
const findShopItem = async (realShopId, productId, productName) => {
  let item = null;
  const numId = Number(productId);
  if (productId && !isNaN(numId) && numId > 0) {
    try {
      item = await Item.findById(numId);
    } catch (_) {}
  }
  if (!item && productId) {
    try {
      item = await Item.findOne({
        shopId: realShopId,
        $or: [{ id: productId }, { _id: productId }]
      });
    } catch (_) {}
  }
  if (!item && productName) {
    const pName = String(productName).trim();
    try {
      item = await Item.findOne({
        shopId: realShopId,
        name: pName
      });
    } catch (_) {}
    if (!item) {
      try {
        const allShopItems = await Item.find({ shopId: realShopId });
        item = (allShopItems || []).find(it =>
          it.name && it.name.trim().toLowerCase() === pName.toLowerCase()
        ) || null;
      } catch (_) {}
    }
  }
  return item;
};

// Helper to safely persist updated stock fields to Item on both MySQL (BaseModel) and MongoDB (Mongoose)
const saveItemStock = async (item, updateFields) => {
  if (!item) return null;
  if (typeof item.save === 'function') {
    Object.assign(item, updateFields);
    await item.save();
    return item;
  }
  const itemId = item.id || item._id;
  if (itemId) {
    return await Item.findByIdAndUpdate(itemId, updateFields);
  }
  return item;
};

// GET all damaged product logs for a shop
router.get('/shop/:shopId', async (req, res) => {
  try {
    const { shopId } = req.params;
    const realShopId = await resolveShopId(shopId);
    let records = [];
    try {
      records = await DamagedProduct.find({ shopId: realShopId }).sort({ damageDate: -1 });
    } catch (_) {
      records = await DamagedProduct.find({ shopId: realShopId });
    }
    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    console.error('[DamagedProduct GET error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST log a new damaged product entry & deduct from product inventory stock
router.post('/shop/:shopId', async (req, res) => {
  try {
    const { shopId } = req.params;
    const realShopId = await resolveShopId(shopId);
    const {
      productName,
      productId,
      quantity,
      unitType,
      petiQuantity,
      trayQuantity,
      eggQuantity,
      unitPrice,
      totalLoss,
      reason,
      damageDate,
      notes,
      reportedBy,
      paymentMethod
    } = req.body;

    const pQty = Math.max(0, Number(petiQuantity) || 0);
    const tQty = Math.max(0, Number(trayQuantity) || 0);
    const eQty = Math.max(0, Number(eggQuantity) || 0);
    const rawQty = Math.max(0, Number(quantity) || 0);

    if (!productName || (pQty <= 0 && tQty <= 0 && eQty <= 0 && rawQty <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Product name and damaged quantity (Petis, Trays or Eggs) are required'
      });
    }

    const unit = String(unitType || 'egg').toLowerCase().trim();
    const price = Number(unitPrice) || 0;

    // Find the item to deduct stock from
    const item = await findShopItem(realShopId, productId, productName);

    const traysPerPeti = Math.max(1, Number(item?.traysPerPeti) || 12);
    const eggsPerTray = Math.max(1, Number(item?.eggsPerTray) || 30);
    const ePerP = traysPerPeti * eggsPerTray;
    const ePerT = eggsPerTray;

    // Exact egg count calculation
    let deductedEggs = 0;
    if (pQty > 0 || tQty > 0 || eQty > 0) {
      deductedEggs = Math.round((pQty * ePerP) + (tQty * ePerT) + eQty);
    } else if (unit === 'peti') {
      deductedEggs = Math.round(rawQty * ePerP);
    } else if (unit === 'tray') {
      deductedEggs = Math.round(rawQty * ePerT);
    } else {
      deductedEggs = Math.round(rawQty);
    }

    // Dynamic loss calculation
    let calculatedLoss = 0;
    if (totalLoss !== undefined && totalLoss !== null && !isNaN(Number(totalLoss)) && Number(totalLoss) > 0) {
      calculatedLoss = Math.round(Number(totalLoss));
    } else {
      const baseCost = Number(
        item?.costPrice ||
        item?.buyCost ||
        item?.purchasePrice ||
        item?.price ||
        item?.salePrice ||
        item?.unitPrice ||
        price ||
        0
      );
      const uType = String(item?.unitType || unit).toLowerCase().trim();
      let eggCost = 0;
      if (uType === 'peti') eggCost = baseCost / ePerP;
      else if (uType === 'tray') eggCost = baseCost / ePerT;
      else eggCost = baseCost;
      calculatedLoss = Math.round(deductedEggs * eggCost);
    }

    // Deduct stock from item inventory
    let updatedItem = item;
    if (item && deductedEggs > 0) {
      const currentStockEggs = Number(item.stock) ||
        (Number(item.petiQuantity) ? Math.round(Number(item.petiQuantity) * ePerP) : (Number(item.eggQuantity) || 0));
      const newStock = Math.max(0, currentStockEggs - deductedEggs);
      const newPetiQty = Number((newStock / ePerP).toFixed(2));
      const newTrayQty = Number((newStock / ePerT).toFixed(1));
      const newEggQty = newStock;

      const updateFields = {
        stock: newStock,
        petiQuantity: newPetiQty,
        trayQuantity: newTrayQty,
        eggQuantity: newEggQty
      };

      updatedItem = await saveItemStock(item, updateFields);
    }

    // Safe integer or null for MySQL productId
    const safeProductId = item ? (Number(item.id || item._id) || null) : (Number(productId) > 0 ? Number(productId) : null);

    const rawMethod = String(paymentMethod || 'CASH').toUpperCase();
    const finalMethod = rawMethod.includes('CREDIT') ? 'CREDIT' : rawMethod.includes('BANK') ? 'BANK' : 'CASH';

    const newRecord = await DamagedProduct.create({
      shopId: realShopId,
      productName: String(productName).trim(),
      productId: safeProductId,
      quantity: rawQty > 0 ? rawQty : (pQty > 0 ? pQty : (tQty > 0 ? tQty : eQty)),
      petiQuantity: pQty,
      trayQuantity: tQty,
      eggQuantity: eQty,
      unitType: unit,
      deductedEggs: deductedEggs,
      unitPrice: price,
      totalLoss: calculatedLoss,
      reason: reason || 'Egg Breakage / Crack',
      damageDate: damageDate ? new Date(damageDate) : new Date(),
      notes: notes || '',
      paymentMethod: finalMethod,
      reportedBy: reportedBy || 'Shop Admin'
    });

    res.status(201).json({ success: true, data: newRecord, updatedItem });
  } catch (error) {
    console.error('[DamagedProduct save error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT edit an existing damaged product log entry & adjust inventory stock difference
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await DamagedProduct.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Damaged record not found' });
    }

    const {
      productName,
      productId,
      quantity,
      unitType,
      petiQuantity,
      trayQuantity,
      eggQuantity,
      unitPrice,
      totalLoss,
      reason,
      damageDate,
      notes,
      reportedBy,
      paymentMethod
    } = req.body;

    const pQty = Math.max(0, Number(petiQuantity !== undefined ? petiQuantity : record.petiQuantity) || 0);
    const tQty = Math.max(0, Number(trayQuantity !== undefined ? trayQuantity : record.trayQuantity) || 0);
    const eQty = Math.max(0, Number(eggQuantity !== undefined ? eggQuantity : record.eggQuantity) || 0);
    const rawQty = Math.max(0, Number(quantity !== undefined ? quantity : record.quantity) || 0);

    const unit = String(unitType || record.unitType || 'egg').toLowerCase().trim();
    const price = Number(unitPrice !== undefined ? unitPrice : record.unitPrice) || 0;

    // Find the item to adjust stock
    const targetProdId = productId || record.productId;
    const item = await findShopItem(record.shopId, targetProdId, productName || record.productName);

    const traysPerPeti = Math.max(1, Number(item?.traysPerPeti) || 12);
    const eggsPerTray = Math.max(1, Number(item?.eggsPerTray) || 30);
    const ePerP = traysPerPeti * eggsPerTray;
    const ePerT = eggsPerTray;

    let newDeductedEggs = 0;
    if (pQty > 0 || tQty > 0 || eQty > 0) {
      newDeductedEggs = Math.round((pQty * ePerP) + (tQty * ePerT) + eQty);
    } else if (unit === 'peti') {
      newDeductedEggs = Math.round(rawQty * ePerP);
    } else if (unit === 'tray') {
      newDeductedEggs = Math.round(rawQty * ePerT);
    } else {
      newDeductedEggs = Math.round(rawQty);
    }

    // Adjust difference in item inventory
    const oldDeductedEggs = Number(record.deductedEggs) || 0;
    const eggDifference = newDeductedEggs - oldDeductedEggs; // > 0 means more damage (deduct from stock), < 0 means less damage (restore to stock)

    let updatedItem = item;
    if (item && eggDifference !== 0) {
      const currentStockEggs = Number(item.stock) ||
        (Number(item.petiQuantity) ? Math.round(Number(item.petiQuantity) * ePerP) : (Number(item.eggQuantity) || 0));
      const updatedStock = Math.max(0, currentStockEggs - eggDifference);
      const newPetiQty = Number((updatedStock / ePerP).toFixed(2));
      const newTrayQty = Number((updatedStock / ePerT).toFixed(1));
      const newEggQty = updatedStock;

      const updateFields = {
        stock: updatedStock,
        petiQuantity: newPetiQty,
        trayQuantity: newTrayQty,
        eggQuantity: newEggQty
      };

      updatedItem = await saveItemStock(item, updateFields);
    }

    let calculatedLoss = 0;
    if (totalLoss !== undefined && totalLoss !== null && !isNaN(Number(totalLoss)) && Number(totalLoss) > 0) {
      calculatedLoss = Math.round(Number(totalLoss));
    } else {
      const baseCost = Number(
        item?.costPrice ||
        item?.buyCost ||
        item?.purchasePrice ||
        item?.price ||
        item?.salePrice ||
        item?.unitPrice ||
        price ||
        0
      );
      const uType = String(item?.unitType || unit).toLowerCase().trim();
      let eggCost = 0;
      if (uType === 'peti') eggCost = baseCost / ePerP;
      else if (uType === 'tray') eggCost = baseCost / ePerT;
      else eggCost = baseCost;
      calculatedLoss = Math.round(newDeductedEggs * eggCost);
    }

    const safeProductId = item ? (Number(item.id || item._id) || null) : (Number(targetProdId) > 0 ? Number(targetProdId) : null);

    const updateData = {
      productName: String(productName || record.productName).trim(),
      productId: safeProductId,
      quantity: rawQty > 0 ? rawQty : (pQty > 0 ? pQty : (tQty > 0 ? tQty : eQty)),
      petiQuantity: pQty,
      trayQuantity: tQty,
      eggQuantity: eQty,
      unitType: unit,
      deductedEggs: newDeductedEggs,
      unitPrice: price,
      totalLoss: calculatedLoss,
      reason: reason || record.reason || 'Egg Breakage / Crack',
      damageDate: damageDate ? new Date(damageDate) : record.damageDate,
      notes: notes !== undefined ? notes : (record.notes || ''),
      reportedBy: reportedBy || record.reportedBy || 'Shop Admin'
    };

    if (paymentMethod !== undefined) {
      const rawMethod = String(paymentMethod).toUpperCase();
      updateData.paymentMethod = rawMethod.includes('CREDIT') ? 'CREDIT' : rawMethod.includes('BANK') ? 'BANK' : 'CASH';
    }

    const updatedRecord = await DamagedProduct.findByIdAndUpdate(id, updateData, { new: true });
    res.json({ success: true, data: updatedRecord, updatedItem });
  } catch (error) {
    console.error('[DamagedProduct update error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE a damaged product log entry by ID & restore inventory stock
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await DamagedProduct.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Damaged record not found' });
    }

    // Restore stock to Item if found
    const item = await findShopItem(record.shopId, record.productId, record.productName);
    const eggsToRestore = Number(record.deductedEggs) || 0;

    if (item && eggsToRestore > 0) {
      const traysPerPeti = Math.max(1, Number(item.traysPerPeti) || 12);
      const eggsPerTray = Math.max(1, Number(item.eggsPerTray) || 30);
      const ePerP = traysPerPeti * eggsPerTray;
      const ePerT = eggsPerTray;

      const currentStockEggs = Number(item.stock) || 0;
      const restoredStock = currentStockEggs + eggsToRestore;
      const newPetiQty = Number((restoredStock / ePerP).toFixed(2));
      const newTrayQty = Number((restoredStock / ePerT).toFixed(1));
      const newEggQty = restoredStock;

      const updateFields = {
        stock: restoredStock,
        petiQuantity: newPetiQty,
        trayQuantity: newTrayQty,
        eggQuantity: newEggQty
      };

      await saveItemStock(item, updateFields);
    }

    await DamagedProduct.findByIdAndDelete(id);
    res.json({ success: true, message: 'Damaged product entry deleted and stock restored' });
  } catch (error) {
    console.error('[DamagedProduct delete error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
