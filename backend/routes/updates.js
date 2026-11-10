import express from 'express';
import SystemUpdate from '../models/SystemUpdate.js';

const router = express.Router();

// @route   GET api/updates
// @desc    Get all active system updates
// @access  Public
router.get('/', async (req, res) => {
  try {
    const updates = await SystemUpdate.find({ isActive: true }).sort({ createdAt: -1 });
    
    // If no updates exist, seed some initial data
    if (updates.length === 0) {
      const initialUpdates = [
        {
          category: "New Features",
          iconType: "zap",
          items: [
            "Intelligence Critical Feed for real-time stock alerts.",
            "Interactive analytics cards with live revenue tracking.",
            "Brandable receipt system with QR code verification."
          ]
        },
        {
          category: "UI Improvements",
          iconType: "sparkles",
          items: [
            "Professional Cobalt & Zinc light theme transition.",
            "Smooth Framer Motion animations across all dashboards.",
            "Optimized mobile layout for on-the-go management."
          ]
        },
        {
          category: "Security & Logic",
          iconType: "shield",
          items: [
            "Robust Zod-based form validation for all inputs.",
            "Improved shift tracking and audit logs.",
            "Automatic stock synchronization and lastUpdated logs."
          ]
        }
      ];
      await SystemUpdate.insertMany(initialUpdates);
      return res.json(initialUpdates);
    }

    res.json(updates);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/updates
// @desc    Create a new system update
// @access  Private (Owner/Admin - logic can be added later)
router.post('/', async (req, res) => {
  const { category, iconType, items } = req.body;
  try {
    const update = await SystemUpdate.create({
      category,
      iconType,
      items
    });
    res.json(update);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

export default router;
