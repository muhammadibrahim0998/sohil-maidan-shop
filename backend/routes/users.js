import express from "express";
import User from "../models/User.js";
import { logSystemUpdate } from "../utils/updateHelper.js";
import pool from "../config/mysql.js";

const router = express.Router();

import { authenticate, requireShopAdmin } from "../middleware/auth.js";
import { memberSchema, validate } from "../validators/memberValidator.js";

// Get all users
router.get("/", authenticate, requireShopAdmin, async (req, res) => {
  try {
    let query = {};
    const isSuper = req.user?.role === 'super_admin' || req.headers['x-user-role'] === 'super_admin';
    if (isSuper) {
      if (req.query.shopId) query.shopId = Number(req.query.shopId);
    } else {
      if (!req.user?.shopId) return res.status(400).json({ message: "shopId is required" });
      query.shopId = req.user.shopId;
    }
    const users = await User.find(query).sort({ createdAt: -1 });
    const cleanUsers = users.map(u => {
      const obj = { ...u };
      delete obj.password;
      return obj;
    });
    res.json(cleanUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new user
router.post("/", authenticate, requireShopAdmin, validate(memberSchema), async (req, res) => {
  try {
    const { username, password, fullName, role, status, preferredShift } = req.body;
    const isSuper = req.user?.role === 'super_admin' || req.headers['x-user-role'] === 'super_admin';
    
    // Prevent shop_admin from creating super_admin
    if (!isSuper && (role === 'super_admin' || role === 'shop_admin')) {
      return res.status(403).json({ message: "Shop admins cannot create other admins" });
    }

    let shopId = null;
    if (isSuper) {
      shopId = req.body.shopId ? Number(req.body.shopId) : null;
    } else {
      shopId = req.user?.shopId ? Number(req.user.shopId) : null;
      if (!shopId && role !== 'super_admin') {
        return res.status(400).json({ message: "shopId is required" });
      }
    }

    // Check if username/handle already exists
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: "A user with this handle or email already exists" });
    }

    const user = await User.create({ 
      username, 
      password: password || undefined, 
      fullName, 
      role: role || 'cashier', 
      status: status || 'active', 
      shopId, 
      preferredShift: preferredShift || 'day' 
    });

    // Auto-record session in the specific branch's cash_sessions table (Maidan Branch)
    if (shopId && (role === 'cashier' || role === 'shop_admin')) {
      const branchPrefixes = { 1: 'maidan_branch' };
      const prefix = branchPrefixes[Number(shopId)] || 'maidan_branch';
      if (prefix) {
        const branchTable = `${prefix}__cash_sessions`;
        try {
          await pool.query(
            `INSERT INTO \`${branchTable}\` (shopId, status, openingCash, closingCash, totalSales, totalReturns, expectedCash, actualCash, openedBy, notes, openedAt) 
             VALUES (?, 'open', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, ?, ?, NOW())`,
            [
              Number(shopId),
              `${user.fullName} (@${user.username})`,
              `Terminal cash session authorized for ${user.fullName} (${preferredShift || 'both'} shift)`
            ]
          );
        } catch (sessErr) {
          console.error("Error creating branch cash session record:", sessErr);
        }
      }
    }

    // Log system update for new team member
    await logSystemUpdate(
      "Security & Logic", 
      "shield", 
      `New Terminal access granted: ${user.fullName} (@${user.username})`
    );

    res.status(201).json({ 
      message: "User created successfully", 
      user: { id: user._id || user.id, username: user.username, role: user.role } 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update user details
router.put("/:id", authenticate, requireShopAdmin, validate(memberSchema), async (req, res) => {
  try {
    const { username, password, fullName, role, status, preferredShift, shopId } = req.body;
    const isSuper = req.user?.role === 'super_admin' || req.headers['x-user-role'] === 'super_admin';
    
    // Security: Only super_admin or shop_admin of the same shop
    const query = isSuper ? 
      { id: req.params.id } : { id: req.params.id, shopId: req.user?.shopId };
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ message: "User not found or unauthorized" });

    // Prevent shop_admin from promoting anyone to super_admin or shop_admin
    if (!isSuper && (role === 'super_admin' || role === 'shop_admin')) {
      return res.status(403).json({ message: "Shop admins cannot assign admin tiers" });
    }

    if (username && username.toLowerCase() !== (user.username || '').toLowerCase()) {
      const existing = await User.findOne({ username });
      if (existing && String(existing.id) !== String(user.id)) {
        return res.status(400).json({ message: "A user with this handle or email already exists" });
      }
      user.username = username;
      user.email = username;
    }

    if (fullName) user.fullName = fullName;
    if (role) user.role = role;
    if (status) user.status = status;
    if (preferredShift) user.preferredShift = preferredShift;
    if (isSuper && shopId !== undefined) {
      user.shopId = (shopId === '' || shopId === null || role === 'super_admin') ? null : Number(shopId);
    }
    if (password && password.trim()) user.password = password.trim();

    await user.save();
    res.json({ message: "User updated successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete user
router.delete("/:id", authenticate, requireShopAdmin, async (req, res) => {
  try {
    const isSuper = req.user?.role === 'super_admin' || req.headers['x-user-role'] === 'super_admin';
    const currentUserId = req.user?.id || req.user?._id;
    if (currentUserId && String(currentUserId) === String(req.params.id)) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const query = isSuper ? 
      { id: req.params.id } : { id: req.params.id, shopId: req.user?.shopId };
    const user = await User.findOneAndDelete(query);
    if (!user) return res.status(404).json({ message: "User not found or unauthorized" });
    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
