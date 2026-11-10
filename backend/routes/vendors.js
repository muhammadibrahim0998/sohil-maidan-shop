import express from 'express';
import pool from '../config/mysql.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const authorizeVendorAccess = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

      const userRole = req.user.role;
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ message: 'Forbidden: Insufficient role' });
      }

      const targetShopId = parseInt(req.params.shopId, 10);
      if (!targetShopId || isNaN(targetShopId)) {
        return res.status(400).json({ message: 'Invalid shopId parameter' });
      }

      // Verify target shop exists
      const [shopCheck] = await pool.query('SELECT id FROM shops WHERE id = ?', [targetShopId]);
      if (shopCheck.length === 0) {
        return res.status(404).json({ message: 'Target shop not found' });
      }

      if (userRole === 'super_admin') {
        req.vendorShopId = targetShopId;
        return next();
      }

      if (req.user.shopId !== targetShopId) {
        return res.status(403).json({ message: 'Forbidden: Shop mismatch' });
      }

      req.vendorShopId = targetShopId;
      next();
    } catch (error) {
      res.status(500).json({ message: 'Authorization error' });
    }
  };
};

// Cashier restricted read endpoint (selector)
router.get('/:shopId', authenticate, authorizeVendorAccess(['cashier', 'shop_admin', 'super_admin']), async (req, res) => {
  try {
    const shopId = req.vendorShopId;
    const [rows] = await pool.query('SELECT id, name FROM vendors WHERE shopId = ? AND isActive = TRUE ORDER BY name ASC', [shopId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching vendors' });
  }
});

// Admin full list
router.get('/:shopId/full', authenticate, authorizeVendorAccess(['shop_admin', 'super_admin']), async (req, res) => {
  try {
    const shopId = req.vendorShopId;
    const [rows] = await pool.query('SELECT * FROM vendors WHERE shopId = ? AND isActive = TRUE ORDER BY name ASC', [shopId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching vendors' });
  }
});

// Add a new vendor
router.post('/:shopId', authenticate, authorizeVendorAccess(['shop_admin', 'super_admin']), async (req, res) => {
  try {
    const shopId = req.vendorShopId;
    const { name, phone, location } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ message: 'Valid vendor name is required' });
    }
    const cleanName = name.trim().substring(0, 100);
    const cleanPhone = phone ? phone.toString().trim().substring(0, 20) : '';
    const cleanLocation = location ? location.toString().trim().substring(0, 255) : '';
    
    const [existing] = await pool.query('SELECT id, isActive FROM vendors WHERE shopId = ? AND name = ?', [shopId, cleanName]);
    if (existing.length > 0) {
      if (existing[0].isActive) return res.status(409).json({ message: 'Vendor with this name already exists' });
      await pool.query('UPDATE vendors SET isActive = TRUE, archivedAt = NULL, phone = ?, location = ? WHERE id = ? AND shopId = ?', [cleanPhone, cleanLocation, existing[0].id, shopId]);
      return res.status(200).json({ id: existing[0].id, shopId, name: cleanName, phone: cleanPhone, location: cleanLocation, isActive: 1 });
    }
    
    const [result] = await pool.query(
      'INSERT INTO vendors (shopId, name, phone, location, isActive) VALUES (?, ?, ?, ?, TRUE)',
      [shopId, cleanName, cleanPhone, cleanLocation]
    );
    
    res.status(201).json({ id: result.insertId, shopId, name: cleanName, phone: cleanPhone, location: cleanLocation, isActive: 1 });
  } catch (error) {
    res.status(500).json({ message: 'Error adding vendor' });
  }
});

// Update a vendor
router.put('/:shopId/:id', authenticate, authorizeVendorAccess(['shop_admin', 'super_admin']), async (req, res) => {
  try {
    const shopId = req.vendorShopId;
    const { id } = req.params;
    const { name, phone, location } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') return res.status(400).json({ message: 'Valid vendor name is required' });
    const cleanName = name.trim().substring(0, 100);
    const cleanPhone = phone ? phone.toString().trim().substring(0, 20) : '';
    const cleanLocation = location ? location.toString().trim().substring(0, 255) : '';
    
    const [existing] = await pool.query('SELECT id FROM vendors WHERE id = ? AND shopId = ? AND isActive = TRUE', [id, shopId]);
    if (existing.length === 0) return res.status(404).json({ message: 'Vendor not found' });

    const [dup] = await pool.query('SELECT id FROM vendors WHERE shopId = ? AND name = ? AND id != ? AND isActive = TRUE', [shopId, cleanName, id]);
    if (dup.length > 0) return res.status(409).json({ message: 'Another active vendor with this name exists' });

    await pool.query(
      'UPDATE vendors SET name = ?, phone = ?, location = ? WHERE id = ? AND shopId = ?',
      [cleanName, cleanPhone, cleanLocation, id, shopId]
    );
    
    res.json({ message: 'Vendor updated' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating vendor' });
  }
});

// Archive (Soft Delete) a vendor
router.delete('/:shopId/:id', authenticate, authorizeVendorAccess(['shop_admin', 'super_admin']), async (req, res) => {
  try {
    const shopId = req.vendorShopId;
    const { id } = req.params;
    
    const [existing] = await pool.query('SELECT id FROM vendors WHERE id = ? AND shopId = ? AND isActive = TRUE', [id, shopId]);
    if (existing.length === 0) return res.status(404).json({ message: 'Vendor not found' });

    await pool.query('UPDATE vendors SET isActive = FALSE, archivedAt = NOW() WHERE id = ? AND shopId = ?', [id, shopId]);
    res.json({ message: 'Vendor archived successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error archiving vendor' });
  }
});

export default router;
