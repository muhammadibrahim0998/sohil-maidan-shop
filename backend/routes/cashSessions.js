import express from 'express';
import CashSession from '../models/CashSession.js';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import pool from '../config/mysql.js';

const router = express.Router();

const BRANCH_CONFIG = [
  { shopId: 1, table: 'maidan_branch__cash_sessions', branchName: 'Maidan Branch' }
];

const getBranchTable = (shopId) => {
  const found = BRANCH_CONFIG.find(b => 
    Number(b.shopId) === Number(shopId) || 
    b.branchName.toLowerCase().includes(String(shopId).toLowerCase()) ||
    b.table.toLowerCase().includes(String(shopId).toLowerCase())
  );
  return found ? found.table : 'maidan_branch__cash_sessions';
};

// GET all sessions across all branches (Attock, Peshawar, Mardan)
router.get('/all', authenticate, async (req, res) => {
  try {
    const isSuper = req.user?.role === 'super_admin' || req.headers['x-user-role'] === 'super_admin';
    const targetShopId = isSuper ? req.query.shopId : (req.user?.shopId || req.query.shopId);

    const targetBranches = targetShopId && targetShopId !== 'ALL'
      ? BRANCH_CONFIG.filter(b => String(b.shopId) === String(targetShopId))
      : BRANCH_CONFIG;

    let allSessions = [];

    for (const b of targetBranches) {
      try {
        const [rows] = await pool.query(`SELECT * FROM \`${b.table}\` ORDER BY id DESC`);
        
        // If a branch table is empty, auto-sync initial active session for any existing branch cashiers/admins
        if (rows.length === 0) {
          const staff = await User.find({ shopId: b.shopId, status: 'active' });
          if (staff && staff.length > 0) {
            for (const member of staff) {
              await pool.query(
                `INSERT INTO \`${b.table}\` (shopId, status, openingCash, closingCash, totalSales, totalReturns, expectedCash, actualCash, openedBy, notes, openedAt) 
                 VALUES (?, 'open', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, ?, ?, NOW())`,
                [
                  b.shopId,
                  `${member.fullName} (@${member.username})`,
                  `Active terminal session for ${member.fullName} (${member.preferredShift || 'both'} shift)`
                ]
              );
            }
            const [syncedRows] = await pool.query(`SELECT * FROM \`${b.table}\` ORDER BY id DESC`);
            rows.push(...syncedRows);
          }
        }

        const formatted = rows.map(r => ({
          ...r,
          shopId: b.shopId,
          branchName: b.branchName,
          openingCash: Number(r.openingCash) || 0,
          closingCash: Number(r.closingCash) || 0,
          totalSales: Number(r.totalSales) || 0,
          totalReturns: Number(r.totalReturns) || 0,
          expectedCash: Number(r.expectedCash) || 0,
          actualCash: Number(r.actualCash) || 0,
        }));
        allSessions.push(...formatted);
      } catch (err) {
        console.error(`Error querying ${b.table}:`, err.message);
      }
    }

    allSessions.sort((a, b) => new Date(b.createdAt || b.openedAt || 0) - new Date(a.createdAt || a.openedAt || 0));
    res.json(allSessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST create cash session for a branch
router.post('/all', authenticate, async (req, res) => {
  try {
    const { shopId, openedBy, openingCash, status, notes } = req.body;
    const finalShopId = Number(shopId) || 3;
    const tableName = getBranchTable(finalShopId);

    const initialCash = Number(openingCash) || 0;
    const sessionStatus = status || 'open';
    const cashierName = openedBy || req.user?.fullName || req.user?.username || 'Branch Cashier';

    const [result] = await pool.query(
      `INSERT INTO \`${tableName}\` (shopId, status, openingCash, closingCash, totalSales, totalReturns, expectedCash, actualCash, openedBy, notes, openedAt)
       VALUES (?, ?, ?, 0.00, 0.00, 0.00, ?, 0.00, ?, ?, NOW())`,
      [
        finalShopId,
        sessionStatus,
        initialCash,
        initialCash,
        cashierName,
        notes || 'Session started'
      ]
    );

    const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` WHERE id = ?`, [result.insertId]);
    res.status(201).json(rows[0] || { id: result.insertId, message: 'Session created' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT update / end session for a branch
router.put('/all/:shopId/:id', authenticate, async (req, res) => {
  try {
    const { shopId, id } = req.params;
    const { status, openingCash, closingCash, actualCash, expectedCash, notes, closedBy, openedBy } = req.body;
    const tableName = getBranchTable(shopId);

    const sets = [];
    const vals = [];

    if (status) {
      sets.push('`status` = ?');
      vals.push(status);
      if (status === 'closed') {
        sets.push('`closedAt` = NOW()');
      } else if (status === 'open') {
        sets.push('`closedAt` = NULL');
      }
    }
    if (openingCash !== undefined) {
      const openVal = Number(openingCash) || 0;
      sets.push('`openingCash` = ?');
      vals.push(openVal);
      if (expectedCash === undefined) {
        sets.push('`expectedCash` = ? + `totalSales` - `totalReturns`');
        vals.push(openVal);
      }
    }
    if (expectedCash !== undefined) {
      sets.push('`expectedCash` = ?');
      vals.push(Number(expectedCash) || 0);
    }
    if (closingCash !== undefined) {
      sets.push('`closingCash` = ?');
      vals.push(Number(closingCash) || 0);
    }
    if (actualCash !== undefined) {
      sets.push('`actualCash` = ?');
      vals.push(Number(actualCash) || 0);
    }
    if (notes !== undefined) {
      sets.push('`notes` = ?');
      vals.push(notes);
    }
    if (closedBy !== undefined) {
      sets.push('`closedBy` = ?');
      vals.push(closedBy);
    }
    if (openedBy !== undefined) {
      sets.push('`openedBy` = ?');
      vals.push(openedBy);
    }

    if (sets.length === 0) {
      return res.json({ message: 'No fields to update' });
    }

    vals.push(Number(id));
    await pool.query(`UPDATE \`${tableName}\` SET ${sets.join(', ')} WHERE id = ?`, vals);

    const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` WHERE id = ?`, [Number(id)]);
    res.json({ message: 'Session updated successfully', session: rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE session from a branch
router.delete('/all/:shopId/:id', authenticate, async (req, res) => {
  try {
    const { shopId, id } = req.params;
    const tableName = getBranchTable(shopId);
    await pool.query(`DELETE FROM \`${tableName}\` WHERE id = ?`, [Number(id)]);
    res.json({ message: 'Session record deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET current open session for active shop
router.get('/current', authenticate, async (req, res) => {
  try {
    const shopId = req.user?.shopId || req.query.shopId || 1;
    const session = await CashSession.findOne({ 
      status: 'open',
      shopId: Number(shopId)
    });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start a new session
router.post('/start', authenticate, async (req, res) => {
  const { openingCash, cashierId, shiftType } = req.body;
  
  try {
    let shopId = req.user?.shopId || req.body.shopId || 1;
    
    if (cashierId && cashierId !== String(req.user?.id || req.user?._id)) {
      const targetUser = await User.findById(cashierId);
      if (targetUser?.shopId) shopId = targetUser.shopId;
    }

    const existing = await CashSession.findOne({ 
      status: 'open',
      shopId: Number(shopId)
    });
    if (existing) {
      return res.status(400).json({ message: 'A session is already open for this shop' });
    }

    const newSession = await CashSession.create({
      openingCash: Number(openingCash) || 0,
      shopId: Number(shopId),
      shiftType: shiftType || 'day',
      status: 'open',
      expectedCash: Number(openingCash) || 0,
      openedBy: req.user?.fullName || req.user?.username || 'Cashier',
      notes: `Started ${shiftType || 'day'} shift`
    });

    res.status(201).json(newSession);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// End current session
router.post('/end', authenticate, async (req, res) => {
  const { actualCash, notes, userId } = req.body;
  const shopId = req.user?.shopId || req.body.shopId || 1;
  
  try {
    const session = await CashSession.findOne({ 
      status: 'open',
      shopId: Number(shopId)
    });
    if (!session) {
      return res.status(404).json({ message: 'No open session found for this shop' });
    }

    session.actualCash = Number(actualCash) || 0;
    session.closingCash = Number(actualCash) || 0;
    session.closedAt = new Date();
    session.status = 'closed';
    session.notes = notes || '';
    session.closedBy = userId || req.user?.fullName || 'Admin';

    const updatedSession = await session.save();
    res.json(updatedSession);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get session history
router.get('/history', authenticate, async (req, res) => {
  try {
    const shopId = req.user?.shopId || req.query.shopId || 1;
    const query = { shopId: Number(shopId) };
    const sessions = await CashSession.find(query)
      .sort({ createdAt: -1 })
      .limit(30);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
