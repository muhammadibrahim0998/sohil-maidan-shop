import express from "express";
import Settings from "../models/Settings.js";
import Shop from "../models/Shop.js";
import { authenticate, preventSuperAdmin } from "../middleware/auth.js";
import { validateSettings } from "../validators/settingsValidator.js";
import { extractPublicIdFromUrl, deleteFromCloudinary } from "../utils/cloudinary.js";

const router = express.Router();

// GET settings (public info)
router.get("/", authenticate, async (req, res) => {
  try {
    const shopId = req.user.shopId;
    if (!shopId) return res.status(400).json({ message: "Shop ID required" });

    let settings = await Settings.findOne({ shopId });
    if (!settings) {
      // Create default settings if none exist for this shop
      settings = await Settings.create({ shopId });
    }
    // Don't send ownerPassword to the frontend unless specifically requested/authorized
    const { ownerPassword, ...publicSettings } = typeof settings.toObject === 'function' ? settings.toObject() : { ...settings };
    if (!publicSettings.currency || publicSettings.currency === '$') {
      publicSettings.currency = 'Rs.';
    }
    res.json(publicSettings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET sensitive settings (requires owner password or admin role)
router.get("/secure", authenticate, preventSuperAdmin, async (req, res) => {
  try {
    const providedPassword = req.get('x-owner-password');
    const shopId = req.user.shopId;
    
    let settings = await Settings.findOne({ shopId });
    if (!settings) {
      settings = await Settings.create({ shopId });
    }

    // Role-based check: Shop Admin is the owner of this tenant
    const isOwner = req.user.role === 'shop_admin';
    
    if (!isOwner && providedPassword !== settings.ownerPassword) {
      return res.status(401).json({ message: "Invalid owner password" });
    }

    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE settings
router.put("/", authenticate, preventSuperAdmin, validateSettings, async (req, res) => {
  try {
    const { currentPassword, ...updates } = req.body;
    const shopId = req.user.shopId;
    
    let settings = await Settings.findOne({ shopId });
    if (!settings) {
      settings = await Settings.create({ shopId });
    }

    // Verify current password to allow updates (Bypass for Shop Admin)
    const isOwner = req.user.role === 'shop_admin';
    if (!isOwner && currentPassword !== settings.ownerPassword) {
      return res.status(401).json({ message: "Current owner password incorrect" });
    }

    const oldLogoUrl = settings.logoUrl;
    Object.assign(settings, updates);
    await settings.save();

    // Cleanup old logo from Cloudinary if it changed
    if (updates.logoUrl !== undefined && oldLogoUrl && oldLogoUrl !== updates.logoUrl) {
      console.log(`[Cleanup] Logo changed. Old: ${oldLogoUrl}, New: ${updates.logoUrl}`);
      const publicId = extractPublicIdFromUrl(oldLogoUrl);
      if (publicId) {
        console.log(`[Cleanup] Extracted publicId: ${publicId}`);
        deleteFromCloudinary(publicId).catch(err => console.error("[Cleanup] Cloudinary cleanup failed:", err));
      } else {
        console.warn(`[Cleanup] Could not extract publicId from ${oldLogoUrl}`);
      }
    }

    // Sync with Shop model if relevant fields were updated
    const shopUpdates = {};
    if (updates.shopName) shopUpdates.name = updates.shopName;
    if (updates.address) shopUpdates.address = updates.address;
    if (updates.phone) shopUpdates.contactNumber = updates.phone;
    if (updates.bankName !== undefined) shopUpdates.bankName = updates.bankName;
    if (updates.bankAccountNumber !== undefined) shopUpdates.bankAccountNumber = updates.bankAccountNumber;
    if (updates.bankAccountTitle !== undefined) shopUpdates.bankAccountTitle = updates.bankAccountTitle;
    if (updates.easypaisaNumber !== undefined) shopUpdates.easypaisaNumber = updates.easypaisaNumber;
    if (updates.ownerFullName || updates.ownerEmail || updates.ownerPhone) {
      shopUpdates['ownerDetails.fullName'] = updates.ownerFullName;
      shopUpdates['ownerDetails.email'] = updates.ownerEmail;
      shopUpdates['ownerDetails.phone'] = updates.ownerPhone;
    }
    if (Object.keys(shopUpdates).length > 0) {
      await Shop.findByIdAndUpdate(shopId, shopUpdates);
    }
    
    const { ownerPassword, ...publicSettings } = settings.toObject();
    res.json(publicSettings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
