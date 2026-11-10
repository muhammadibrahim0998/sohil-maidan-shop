import express from 'express';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { validateShop } from '../validators/shopValidator.js';
import Shop from '../models/Shop.js';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import Item, { getBranchItemModel } from '../models/Item.js';
import pool from '../config/mysql.js';
import { resolveShopId } from '../utils/shopResolver.js';
import { refreshBranchPrefixes } from '../models/dbHelper.js';

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

const router = express.Router();

// Synchronize all bank accounts directly into MySQL columns & shop_banks table
const syncShopBanksToDatabase = async (shopId, banksList) => {
  try {
    if (!shopId) return;
    const list = Array.isArray(banksList) ? banksList.filter(b => b && (b.bankName || b.bankAccountNumber || b.bankAccountTitle)) : [];

    // 1. Sync shop_banks table
    await pool.query('DELETE FROM shop_banks WHERE shopId = ?', [shopId]);
    for (const b of list) {
      await pool.query(
        'INSERT INTO shop_banks (shopId, bankName, bankAccountNumber, bankAccountTitle) VALUES (?, ?, ?, ?)',
        [shopId, b.bankName || '', b.bankAccountNumber || '', b.bankAccountTitle || '']
      );
    }

    // 2. Prepare multi-bank combined strings and indexed columns
    const combinedNames = list.map(b => b.bankName).filter(Boolean).join(' | ');
    const combinedAccounts = list.map(b => b.bankAccountNumber).filter(Boolean).join(' | ');
    const combinedTitles = list.map(b => b.bankAccountTitle).filter(Boolean).join(' | ');

    const b1 = list[0] || {};
    const b2 = list[1] || {};
    const b3 = list[2] || {};
    const jsonStr = JSON.stringify(list);

    // Update shops table columns
    await pool.query(`
      UPDATE shops SET 
        bankName = ?,
        bankAccountNumber = ?,
        bankAccountTitle = ?,
        bankName2 = ?,
        bankAccountNumber2 = ?,
        bankAccountTitle2 = ?,
        bankName3 = ?,
        bankAccountNumber3 = ?,
        bankAccountTitle3 = ?,
        banksJson = ?
      WHERE id = ?
    `, [
      combinedNames || b1.bankName || '',
      combinedAccounts || b1.bankAccountNumber || '',
      combinedTitles || b1.bankAccountTitle || '',
      b2.bankName || null,
      b2.bankAccountNumber || null,
      b2.bankAccountTitle || null,
      b3.bankName || null,
      b3.bankAccountNumber || null,
      b3.bankAccountTitle || null,
      jsonStr,
      shopId
    ]);

    // Update settings table columns
    await pool.query(`
      UPDATE settings SET 
        bankName = ?,
        bankAccountNumber = ?,
        bankAccountTitle = ?,
        bankName2 = ?,
        bankAccountNumber2 = ?,
        bankAccountTitle2 = ?,
        bankName3 = ?,
        bankAccountNumber3 = ?,
        bankAccountTitle3 = ?,
        banksJson = ?
      WHERE shopId = ?
    `, [
      combinedNames || b1.bankName || '',
      combinedAccounts || b1.bankAccountNumber || '',
      combinedTitles || b1.bankAccountTitle || '',
      b2.bankName || null,
      b2.bankAccountNumber || null,
      b2.bankAccountTitle || null,
      b3.bankName || null,
      b3.bankAccountNumber || null,
      b3.bankAccountTitle || null,
      jsonStr,
      shopId
    ]);
  } catch (err) {
    console.error('Error syncing shop_banks to database:', err);
  }
};


// Helper to extract and normalize banks array
const normalizeBanks = (rawBanks, fallback = {}) => {
  let list = [];
  if (Array.isArray(rawBanks)) {
    list = rawBanks.filter(b => b && typeof b === 'object' && (b.bankName || b.bankAccountNumber || b.bankAccountTitle));
  } else if (typeof rawBanks === 'string') {
    try {
      const parsed = JSON.parse(rawBanks);
      if (Array.isArray(parsed)) {
        list = parsed.filter(b => b && typeof b === 'object' && (b.bankName || b.bankAccountNumber || b.bankAccountTitle));
      }
    } catch (_) {}
  }
  if (list.length === 0 && (fallback.bankName || fallback.bankAccountNumber)) {
    list = [{
      bankName: fallback.bankName || '',
      bankAccountNumber: fallback.bankAccountNumber || '',
      bankAccountTitle: fallback.bankAccountTitle || ''
    }];
  }
  return list;
};

// Get all active shops (Public / Storefront)
router.get('/public', async (req, res) => {
  try {
    const shops = await Shop.find({ status: 'active' }).sort({ createdAt: 1 });
    const enriched = await Promise.all(shops.map(async (s) => {
      const raw = typeof s.toObject === 'function' ? s.toObject() : { ...s };
      try {
        const st = await Settings.findOne({ shopId: s._id || s.id });
        if (st) {
          raw.bankName = raw.bankName || st.bankName || '';
          raw.bankAccountNumber = raw.bankAccountNumber || st.bankAccountNumber || '';
          raw.bankAccountTitle = raw.bankAccountTitle || st.bankAccountTitle || '';
          raw.easypaisaNumber = raw.easypaisaNumber || st.easypaisaNumber || '';
          if ((!raw.banksJson || raw.banksJson.length === 0) && st.banksJson) {
            raw.banksJson = st.banksJson;
          }
        }
      } catch (e) {}
      raw.banks = normalizeBanks(raw.banksJson || raw.banks, raw);
      raw.banksJson = raw.banks;
      if (raw.banks.length > 0) {
        raw.bankName = raw.banks[0].bankName || raw.bankName || '';
        raw.bankAccountNumber = raw.banks[0].bankAccountNumber || raw.bankAccountNumber || '';
        raw.bankAccountTitle = raw.banks[0].bankAccountTitle || raw.bankAccountTitle || '';
      }
      let pages = raw.allowedPages;
      if (typeof pages === 'string') {
        try { pages = JSON.parse(pages); } catch { pages = null; }
      }
      if (Array.isArray(pages)) {
        raw.allowedPages = pages;
      } else {
        raw.allowedPages = raw.approvalStatus === 'LOCKED' ? [] : ALL_DEFAULT_BRANCH_PAGES;
      }
      return raw;
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all shops (Super Admin only)
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const shops = await Shop.find().sort({ createdAt: -1 });
    const enrichedShops = await Promise.all(shops.map(async (s) => {
      const raw = typeof s.toObject === 'function' ? s.toObject() : { ...s };
      try {
        const st = await Settings.findOne({ shopId: s._id || s.id });
        if (st) {
          raw.bankName = raw.bankName || st.bankName || '';
          raw.bankAccountNumber = raw.bankAccountNumber || st.bankAccountNumber || '';
          raw.bankAccountTitle = raw.bankAccountTitle || st.bankAccountTitle || '';
          raw.easypaisaNumber = raw.easypaisaNumber || st.easypaisaNumber || '';
          if ((!raw.banksJson || raw.banksJson.length === 0) && st.banksJson) {
            raw.banksJson = st.banksJson;
          }
        }
      } catch (e) {}
      raw.banks = normalizeBanks(raw.banksJson || raw.banks, raw);
      raw.banksJson = raw.banks;
      if (raw.banks.length > 0) {
        raw.bankName = raw.banks[0].bankName || raw.bankName || '';
        raw.bankAccountNumber = raw.banks[0].bankAccountNumber || raw.bankAccountNumber || '';
        raw.bankAccountTitle = raw.banks[0].bankAccountTitle || raw.bankAccountTitle || '';
      }
      let pList = raw.allowedPages;
      if (typeof pList === 'string') {
        try { pList = JSON.parse(pList); } catch { pList = null; }
      }
      if (Array.isArray(pList)) {
        raw.allowedPages = pList;
      } else {
        raw.allowedPages = raw.approvalStatus === 'LOCKED' ? [] : ALL_DEFAULT_BRANCH_PAGES;
      }
      return raw;
    }));
    res.json(enrichedShops);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create shop (Super Admin only)
router.post('/', authenticate, requireSuperAdmin, validateShop, async (req, res) => {
  try {
    const { 
      name, address, contactNumber, adminUsername, adminPassword, adminFullName, adminEmail, adminPhone, 
      logoUrl, easypaisaNumber, bankName, bankAccountNumber, bankAccountTitle, banks 
    } = req.body;
    
    // Check if username is taken
    if (adminUsername) {
      const existingUser = await User.findOne({ username: adminUsername });
      if (existingUser) {
        return res.status(400).json({ message: "Admin username is already taken" });
      }
    }

    const banksList = normalizeBanks(banks, { bankName, bankAccountNumber, bankAccountTitle });
    const primaryBank = banksList[0] || {};

    const shop = await Shop.create({ 
      name, 
      address, 
      contactNumber, 
      logoUrl,
      easypaisaNumber: easypaisaNumber || '',
      bankName: primaryBank.bankName || bankName || '',
      bankAccountNumber: primaryBank.bankAccountNumber || bankAccountNumber || '',
      bankAccountTitle: primaryBank.bankAccountTitle || bankAccountTitle || '',
      banks: banksList,
      banksJson: banksList,
      ownerDetails: {
        fullName: adminFullName || 'Shop Admin',
        email: adminEmail || adminUsername || '',
        phone: adminPhone || ''
      }
    });

    // Create initial settings for the shop
    const settings = await Settings.create({
      shopId: shop._id || shop.id,
      shopName: name,
      address: address || '',
      phone: contactNumber || '',
      easypaisaNumber: easypaisaNumber || '',
      easypaisaEnabled: easypaisaNumber ? true : false,
      bankName: primaryBank.bankName || bankName || '',
      bankAccountNumber: primaryBank.bankAccountNumber || bankAccountNumber || '',
      bankAccountTitle: primaryBank.bankAccountTitle || bankAccountTitle || '',
      banksJson: banksList,
    });

    let adminUser = null;
    if (adminUsername && adminPassword) {
      adminUser = await User.create({
        username: adminUsername,
        password: adminPassword,
        email: adminEmail || adminUsername || undefined,
        fullName: adminFullName || 'Shop Admin',
        role: 'shop_admin',
        shopId: shop._id || shop.id
      });
    }

    await syncShopBanksToDatabase(shop._id || shop.id, banksList);

    res.status(201).json({ shop, adminUser, settings });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// Helper to ensure all required shop and bank columns & tables exist dynamically in MySQL
export async function ensureShopApprovalColumns() {
  try {
    // 1. Ensure shop_banks table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`shop_banks\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`shopId\` INT NOT NULL,
        \`bankName\` VARCHAR(255) NULL,
        \`bankAccountNumber\` VARCHAR(255) NULL,
        \`bankAccountTitle\` VARCHAR(255) NULL,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (\`shopId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Ensure columns in shops table
    const [shopCols] = await pool.query('DESCRIBE `shops`');
    const shopSet = new Set(shopCols.map(c => c.Field));
    
    if (!shopSet.has('bankName')) await pool.query('ALTER TABLE `shops` ADD COLUMN `bankName` VARCHAR(255) NULL');
    if (!shopSet.has('bankAccountNumber')) await pool.query('ALTER TABLE `shops` ADD COLUMN `bankAccountNumber` VARCHAR(255) NULL');
    if (!shopSet.has('bankAccountTitle')) await pool.query('ALTER TABLE `shops` ADD COLUMN `bankAccountTitle` VARCHAR(255) NULL');
    if (!shopSet.has('bankName2')) await pool.query('ALTER TABLE `shops` ADD COLUMN `bankName2` VARCHAR(255) NULL');
    if (!shopSet.has('bankAccountNumber2')) await pool.query('ALTER TABLE `shops` ADD COLUMN `bankAccountNumber2` VARCHAR(255) NULL');
    if (!shopSet.has('bankAccountTitle2')) await pool.query('ALTER TABLE `shops` ADD COLUMN `bankAccountTitle2` VARCHAR(255) NULL');
    if (!shopSet.has('bankName3')) await pool.query('ALTER TABLE `shops` ADD COLUMN `bankName3` VARCHAR(255) NULL');
    if (!shopSet.has('bankAccountNumber3')) await pool.query('ALTER TABLE `shops` ADD COLUMN `bankAccountNumber3` VARCHAR(255) NULL');
    if (!shopSet.has('bankAccountTitle3')) await pool.query('ALTER TABLE `shops` ADD COLUMN `bankAccountTitle3` VARCHAR(255) NULL');
    if (!shopSet.has('easypaisaNumber')) await pool.query('ALTER TABLE `shops` ADD COLUMN `easypaisaNumber` VARCHAR(100) NULL');
    if (!shopSet.has('banksJson')) await pool.query('ALTER TABLE `shops` ADD COLUMN `banksJson` LONGTEXT NULL');
    if (!shopSet.has('isEditApproved')) await pool.query('ALTER TABLE `shops` ADD COLUMN `isEditApproved` TINYINT(1) DEFAULT 1');
    if (!shopSet.has('isDeleteApproved')) await pool.query('ALTER TABLE `shops` ADD COLUMN `isDeleteApproved` TINYINT(1) DEFAULT 1');
    if (!shopSet.has('approvalStatus')) await pool.query("ALTER TABLE `shops` ADD COLUMN `approvalStatus` VARCHAR(100) DEFAULT 'APPROVED'");
    if (!shopSet.has('approvalNotes')) await pool.query('ALTER TABLE `shops` ADD COLUMN `approvalNotes` TEXT NULL');
    if (!shopSet.has('allowedPages')) await pool.query('ALTER TABLE `shops` ADD COLUMN `allowedPages` LONGTEXT NULL');

    // Auto-fix column types in case production database has restrictive ENUM or short VARCHAR lengths
    try { await pool.query("ALTER TABLE `shops` MODIFY COLUMN `approvalStatus` VARCHAR(100) NOT NULL DEFAULT 'APPROVED'"); } catch (_) {}
    try { await pool.query("ALTER TABLE `shops` MODIFY COLUMN `allowedPages` LONGTEXT NULL"); } catch (_) {}
    try { await pool.query("ALTER TABLE `shops` MODIFY COLUMN `isEditApproved` TINYINT(1) NOT NULL DEFAULT 1"); } catch (_) {}
    try { await pool.query("ALTER TABLE `shops` MODIFY COLUMN `isDeleteApproved` TINYINT(1) NOT NULL DEFAULT 1"); } catch (_) {}
    if (!shopSet.has('ownerFullName')) await pool.query('ALTER TABLE `shops` ADD COLUMN `ownerFullName` VARCHAR(255) NULL');
    if (!shopSet.has('ownerEmail')) await pool.query('ALTER TABLE `shops` ADD COLUMN `ownerEmail` VARCHAR(255) NULL');
    if (!shopSet.has('ownerPhone')) await pool.query('ALTER TABLE `shops` ADD COLUMN `ownerPhone` VARCHAR(100) NULL');
    if (!shopSet.has('ownerPassword')) await pool.query("ALTER TABLE `shops` ADD COLUMN `ownerPassword` VARCHAR(255) DEFAULT 'admin123'");
    if (!shopSet.has('superAdminEmail')) await pool.query("ALTER TABLE `shops` ADD COLUMN `superAdminEmail` VARCHAR(255) DEFAULT 'Mainyet123@gmail.com'");
    if (!shopSet.has('superAdminPassword')) await pool.query("ALTER TABLE `shops` ADD COLUMN `superAdminPassword` VARCHAR(255) DEFAULT 'super123456.'");

    // 3. Ensure columns in settings table
    try {
      const [settingCols] = await pool.query('DESCRIBE `settings`');
      const settingSet = new Set(settingCols.map(c => c.Field));
      if (!settingSet.has('bankName')) await pool.query('ALTER TABLE `settings` ADD COLUMN `bankName` VARCHAR(255) NULL');
      if (!settingSet.has('bankAccountNumber')) await pool.query('ALTER TABLE `settings` ADD COLUMN `bankAccountNumber` VARCHAR(255) NULL');
      if (!settingSet.has('bankAccountTitle')) await pool.query('ALTER TABLE `settings` ADD COLUMN `bankAccountTitle` VARCHAR(255) NULL');
      if (!settingSet.has('bankName2')) await pool.query('ALTER TABLE `settings` ADD COLUMN `bankName2` VARCHAR(255) NULL');
      if (!settingSet.has('bankAccountNumber2')) await pool.query('ALTER TABLE `settings` ADD COLUMN `bankAccountNumber2` VARCHAR(255) NULL');
      if (!settingSet.has('bankAccountTitle2')) await pool.query('ALTER TABLE `settings` ADD COLUMN `bankAccountTitle2` VARCHAR(255) NULL');
      if (!settingSet.has('bankName3')) await pool.query('ALTER TABLE `settings` ADD COLUMN `bankName3` VARCHAR(255) NULL');
      if (!settingSet.has('bankAccountNumber3')) await pool.query('ALTER TABLE `settings` ADD COLUMN `bankAccountNumber3` VARCHAR(255) NULL');
      if (!settingSet.has('bankAccountTitle3')) await pool.query('ALTER TABLE `settings` ADD COLUMN `bankAccountTitle3` VARCHAR(255) NULL');
      if (!settingSet.has('banksJson')) await pool.query('ALTER TABLE `settings` ADD COLUMN `banksJson` LONGTEXT NULL');
      if (!settingSet.has('easypaisaNumber')) await pool.query('ALTER TABLE `settings` ADD COLUMN `easypaisaNumber` VARCHAR(100) NULL');
      if (!settingSet.has('easypaisaEnabled')) await pool.query('ALTER TABLE `settings` ADD COLUMN `easypaisaEnabled` TINYINT(1) DEFAULT 0');
    } catch (_) {}

    // Backfill defaults
    await pool.query("UPDATE `shops` SET `isEditApproved` = 1 WHERE `isEditApproved` IS NULL");
    await pool.query("UPDATE `shops` SET `isDeleteApproved` = 1 WHERE `isDeleteApproved` IS NULL");
    await pool.query("UPDATE `shops` SET `approvalStatus` = 'APPROVED' WHERE `approvalStatus` IS NULL OR `approvalStatus` = ''");
    await pool.query("UPDATE `shops` SET `superAdminEmail` = 'Mainyet123@gmail.com' WHERE `superAdminEmail` IS NULL OR `superAdminEmail` = ''");
    await pool.query("UPDATE `shops` SET `superAdminPassword` = 'super123456.' WHERE `superAdminPassword` IS NULL OR `superAdminPassword` = ''");
  } catch (e) {
    console.warn('ensureShopApprovalColumns warning:', e.message);
  }
}

// Update shop details
const handleShopUpdate = async (req, res) => {
  try {
    await ensureShopApprovalColumns();

    const targetId = await resolveShopId(req.params.id) || req.params.id;
    const { 
      name, address, contactNumber, status, ownerEmail, easypaisaNumber, 
      bankName, bankAccountNumber, bankAccountTitle, banks 
    } = req.body;
    
    // Authorization Check: Super Admin OR the Shop's Admin
    const isSuperAdmin = req.user?.role === 'super_admin' || req.headers['x-user-role'] === 'super_admin';
    const userShopId = req.user?.shopId ? String(req.user.shopId) : null;
    const isOwnShop = userShopId && (userShopId === String(req.params.id) || userShopId === String(targetId));

    if (!isSuperAdmin && !isOwnShop) {
      return res.status(403).json({ message: "Not authorized to update this shop" });
    }

    const shop = await Shop.findById(targetId);
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    // Normalize banks
    const banksList = normalizeBanks(banks !== undefined ? banks : shop.banksJson, { 
      bankName: bankName !== undefined ? bankName : shop.bankName, 
      bankAccountNumber: bankAccountNumber !== undefined ? bankAccountNumber : shop.bankAccountNumber, 
      bankAccountTitle: bankAccountTitle !== undefined ? bankAccountTitle : shop.bankAccountTitle 
    });

    const b1 = banksList[0] || {};
    const b2 = banksList[1] || {};
    const b3 = banksList[2] || {};
    const combinedNames = banksList.map(b => b.bankName).filter(Boolean).join(' | ');
    const combinedAccounts = banksList.map(b => b.bankAccountNumber).filter(Boolean).join(' | ');
    const combinedTitles = banksList.map(b => b.bankAccountTitle).filter(Boolean).join(' | ');
    const jsonStr = JSON.stringify(banksList);

    const newName = name !== undefined ? name : shop.name;
    const newAddress = address !== undefined ? address : shop.address;
    const newContactNumber = contactNumber !== undefined ? contactNumber : shop.contactNumber;
    const newStatus = (isSuperAdmin && status) ? status : (shop.status || 'active');
    const newOwnerEmail = ownerEmail !== undefined ? ownerEmail : (shop.ownerEmail || shop.ownerDetails?.email || '');
    const newEasypaisaNumber = easypaisaNumber !== undefined ? easypaisaNumber : (shop.easypaisaNumber || '');

    // 1. Direct Dynamic SQL UPDATE on shops table
    await pool.query(`
      UPDATE \`shops\` SET 
        \`name\` = ?,
        \`address\` = ?,
        \`contactNumber\` = ?,
        \`status\` = ?,
        \`ownerEmail\` = ?,
        \`easypaisaNumber\` = ?,
        \`bankName\` = ?,
        \`bankAccountNumber\` = ?,
        \`bankAccountTitle\` = ?,
        \`bankName2\` = ?,
        \`bankAccountNumber2\` = ?,
        \`bankAccountTitle2\` = ?,
        \`bankName3\` = ?,
        \`bankAccountNumber3\` = ?,
        \`bankAccountTitle3\` = ?,
        \`banksJson\` = ?
      WHERE \`id\` = ?
    `, [
      newName,
      newAddress,
      newContactNumber,
      newStatus,
      newOwnerEmail,
      newEasypaisaNumber,
      combinedNames || b1.bankName || '',
      combinedAccounts || b1.bankAccountNumber || '',
      combinedTitles || b1.bankAccountTitle || '',
      b2.bankName || null,
      b2.bankAccountNumber || null,
      b2.bankAccountTitle || null,
      b3.bankName || null,
      b3.bankAccountNumber || null,
      b3.bankAccountTitle || null,
      jsonStr,
      targetId
    ]);

    // 2. Direct Dynamic SQL UPDATE on settings table
    try {
      await pool.query(`
        UPDATE \`settings\` SET 
          \`shopName\` = ?,
          \`address\` = ?,
          \`phone\` = ?,
          \`easypaisaNumber\` = ?,
          \`easypaisaEnabled\` = ?,
          \`bankName\` = ?,
          \`bankAccountNumber\` = ?,
          \`bankAccountTitle\` = ?,
          \`bankName2\` = ?,
          \`bankAccountNumber2\` = ?,
          \`bankAccountTitle2\` = ?,
          \`bankName3\` = ?,
          \`bankAccountNumber3\` = ?,
          \`bankAccountTitle3\` = ?,
          \`banksJson\` = ?
        WHERE \`shopId\` = ?
      `, [
        newName,
        newAddress,
        newContactNumber,
        newEasypaisaNumber,
        newEasypaisaNumber ? 1 : 0,
        combinedNames || b1.bankName || '',
        combinedAccounts || b1.bankAccountNumber || '',
        combinedTitles || b1.bankAccountTitle || '',
        b2.bankName || null,
        b2.bankAccountNumber || null,
        b2.bankAccountTitle || null,
        b3.bankName || null,
        b3.bankAccountNumber || null,
        b3.bankAccountTitle || null,
        jsonStr,
        targetId
      ]);
    } catch (setErr) {
      console.warn('Settings update warning:', setErr.message);
    }

    // 3. Sync shop_banks table
    await syncShopBanksToDatabase(targetId, banksList);

    // 4. Update associated shop admin user email if provided
    if (newOwnerEmail) {
      try {
        await pool.query(
          'UPDATE \`users\` SET \`email\` = ? WHERE \`shopId\` = ? AND \`role\` = "shop_admin"',
          [newOwnerEmail, targetId]
        );
      } catch (uErr) {
        console.warn('User email sync warning:', uErr.message);
      }
    }

    // Refresh dynamic branch routing prefixes
    await refreshBranchPrefixes();

    // Query freshly updated shop row
    const updatedShop = await Shop.findById(targetId);
    res.json(updatedShop || {
      id: targetId,
      _id: targetId,
      name: newName,
      address: newAddress,
      contactNumber: newContactNumber,
      status: newStatus,
      ownerEmail: newOwnerEmail,
      easypaisaNumber: newEasypaisaNumber,
      banks: banksList,
      banksJson: banksList,
      bankName: combinedNames || b1.bankName || '',
      bankAccountNumber: combinedAccounts || b1.bankAccountNumber || '',
      bankAccountTitle: combinedTitles || b1.bankAccountTitle || ''
    });
  } catch (error) {
    console.error('Error updating shop:', error);
    res.status(400).json({ message: error.message });
  }
};

router.put('/:id', authenticate, validateShop, handleShopUpdate);
router.patch('/:id', authenticate, validateShop, handleShopUpdate);
router.post('/:id/update', authenticate, validateShop, handleShopUpdate);

// Update shop branch approval settings (Super Admin only)
const handleShopApprovalUpdate = async (req, res) => {
  try {
    await ensureShopApprovalColumns();
    const { isEditApproved, isDeleteApproved, approvalStatus, approvalNotes, allowedPages } = req.body;
    const targetId = req.params.id;

    const newEditApproved = isEditApproved !== undefined ? (isEditApproved ? 1 : 0) : 1;
    const newDeleteApproved = isDeleteApproved !== undefined ? (isDeleteApproved ? 1 : 0) : 1;
    const newStatus = approvalStatus !== undefined ? approvalStatus : 'APPROVED';
    const newNotes = approvalNotes !== undefined ? approvalNotes : '';
    const newPages = Array.isArray(allowedPages) ? allowedPages : (allowedPages ? [allowedPages] : []);
    const pagesJson = JSON.stringify(newPages);

    // Support updating ALL branches at once
    if (String(targetId).toUpperCase() === 'ALL') {
      await pool.query(
        'UPDATE `shops` SET `isEditApproved` = ?, `isDeleteApproved` = ?, `approvalStatus` = ?, `approvalNotes` = ?, `allowedPages` = ?',
        [newEditApproved, newDeleteApproved, newStatus, newNotes, pagesJson]
      );
      const allShops = await Shop.find();
      return res.json({
        success: true,
        message: 'All branches approval status updated successfully',
        shops: allShops
      });
    }

    const resolvedId = await resolveShopId(targetId);
    const shop = await Shop.findById(resolvedId || targetId) || await Shop.findOne({ name: targetId });
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    const actualShopId = shop.id || shop._id || resolvedId || targetId;

    // Direct SQL update to ensure immediate persistence across all caching mechanisms
    await pool.query(
      'UPDATE `shops` SET `isEditApproved` = ?, `isDeleteApproved` = ?, `approvalStatus` = ?, `approvalNotes` = ?, `allowedPages` = ? WHERE `id` = ? OR `name` = ?',
      [newEditApproved, newDeleteApproved, newStatus, newNotes, pagesJson, actualShopId, shop.name]
    );

    const updatedShop = await Shop.findById(actualShopId);
    res.json({
      success: true,
      message: 'Branch approval status updated successfully',
      shop: updatedShop || {
        ...shop,
        id: actualShopId,
        _id: actualShopId,
        isEditApproved: newEditApproved,
        isDeleteApproved: newDeleteApproved,
        approvalStatus: newStatus,
        approvalNotes: newNotes,
        allowedPages: newPages
      }
    });
  } catch (error) {
    console.error('Error updating branch approval:', error);
    res.status(500).json({ message: error.message });
  }
};

router.patch('/:id/approval', authenticate, requireSuperAdmin, handleShopApprovalUpdate);
router.put('/:id/approval', authenticate, requireSuperAdmin, handleShopApprovalUpdate);
router.post('/:id/approval', authenticate, requireSuperAdmin, handleShopApprovalUpdate);
router.post('/approval/:id', authenticate, requireSuperAdmin, handleShopApprovalUpdate);
router.post('/approval', authenticate, requireSuperAdmin, handleShopApprovalUpdate);

// Delete shop (Super Admin only)
const handleShopDelete = async (req, res) => {
  try {
    const targetId = await resolveShopId(req.params.id) || req.params.id;
    const shop = await Shop.findById(targetId);
    if (!shop) return res.status(404).json({ message: 'Shop not found' });

    // 1. Delete associated child records first to satisfy MySQL Foreign Key constraints
    try { await pool.query('DELETE FROM `shop_banks` WHERE `shopId` = ?', [targetId]); } catch (_) {}
    try { await pool.query('DELETE FROM `settings` WHERE `shopId` = ?', [targetId]); } catch (_) {}
    try { await pool.query('DELETE FROM `users` WHERE `shopId` = ?', [targetId]); } catch (_) {}
    try { await Item.deleteMany({ shopId: targetId }); } catch (_) {}
    try {
      const BranchModel = getBranchItemModel(targetId);
      await BranchModel.deleteMany({});
    } catch (_) {}

    // 2. Safely delete from shops table
    await pool.query('DELETE FROM `shops` WHERE `id` = ?', [targetId]);
    await refreshBranchPrefixes();

    res.json({ message: 'Shop and associated records deleted successfully' });
  } catch (error) {
    console.error('Error deleting shop:', error);
    res.status(500).json({ message: error.message });
  }
};

router.delete('/:id', authenticate, requireSuperAdmin, handleShopDelete);
router.post('/:id/delete', authenticate, requireSuperAdmin, handleShopDelete);

// Self-healing columns setup on startup
ensureShopApprovalColumns().catch(err => console.warn('ensureShopApprovalColumns init error:', err.message));

export default router;
