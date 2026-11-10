import express from 'express';
import pool from '../config/mysql.js';
import { resolveShopId } from '../utils/shopResolver.js';
import { BRANCH_TABLE_PREFIXES, ALL_BRANCH_PREFIXES } from '../models/dbHelper.js';

const router = express.Router();

const checkedTables = new Set();

// Ensure dynamic branch fuel expenses table exists
export async function ensureBranchFuelTable(tableName) {
  if (checkedTables.has(tableName)) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`shopId\` INT NOT NULL DEFAULT 1,
        \`vehicleNo\` VARCHAR(100) NOT NULL,
        \`vehicleName\` VARCHAR(150) NULL,
        \`driverName\` VARCHAR(150) NULL,
        \`driverPhone\` VARCHAR(50) NULL,
        \`purpose\` VARCHAR(255) DEFAULT 'Stock Purchase Transport',
        \`fuelType\` VARCHAR(50) DEFAULT 'Diesel',
        \`liters\` DECIMAL(10,2) DEFAULT 0.00,
        \`ratePerLiter\` DECIMAL(10,2) DEFAULT 0.00,
        \`totalAmount\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        \`paymentMethod\` VARCHAR(50) DEFAULT 'CASH',
        \`paidAmount\` DECIMAL(12,2) DEFAULT 0.00,
        \`dueAmount\` DECIMAL(12,2) DEFAULT 0.00,
        \`petrolPump\` VARCHAR(255) NULL,
        \`odometerReading\` VARCHAR(50) NULL,
        \`expenseDate\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`notes\` TEXT NULL,
        \`createdBy\` VARCHAR(255) DEFAULT 'Shop Admin',
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY \`idx_fuel_shopId\` (\`shopId\`),
        KEY \`idx_fuel_date\` (\`expenseDate\`),
        KEY \`idx_fuel_vehicle\` (\`vehicleNo\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    checkedTables.add(tableName);
  } catch (err) {
    console.error(`[FuelExpense Table Error] Table ${tableName}:`, err.message);
  }
}

// Helper to resolve the exact branch table name for any given shop
export const getBranchFuelTable = async (rawShopId) => {
  let realShopId = 1;
  if (rawShopId) {
    const resolved = await resolveShopId(rawShopId);
    if (resolved) realShopId = Number(resolved) || 1;
  }
  const prefix = BRANCH_TABLE_PREFIXES[realShopId] || 'peshawar_branch';
  const tableName = `${prefix}__fuel_expenses`;
  await ensureBranchFuelTable(tableName);
  return { tableName, shopId: realShopId, prefix };
};

// GET all fuel expenses across all branches (or filtered by shopId)
router.get('/', async (req, res) => {
  try {
    const rawShopId = req.query.shopId || req.headers['x-shop-id'];

    if (rawShopId && String(rawShopId).toUpperCase() !== 'ALL') {
      const { tableName, shopId } = await getBranchFuelTable(rawShopId);
      const [rows] = await pool.query(
        `SELECT * FROM \`${tableName}\` ORDER BY \`expenseDate\` DESC, \`id\` DESC`
      );
      return res.json({ success: true, count: rows.length, data: rows });
    }

    // Super Admin view: Union across all known branch tables
    const branchPrefixes = ALL_BRANCH_PREFIXES || ['peshawar_branch', 'mardan_branch', 'attock_branch'];
    let allRecords = [];

    for (const pfx of branchPrefixes) {
      const tName = `${pfx}__fuel_expenses`;
      await ensureBranchFuelTable(tName);
      try {
        const [rows] = await pool.query(`SELECT * FROM \`${tName}\``);
        allRecords.push(...rows);
      } catch (e) {
        console.warn(`Query on ${tName} error:`, e.message);
      }
    }

    // Sort combined records descending by date & id
    allRecords.sort((a, b) => new Date(b.expenseDate || b.createdAt) - new Date(a.expenseDate || a.createdAt) || b.id - a.id);

    res.json({ success: true, count: allRecords.length, data: allRecords });
  } catch (error) {
    console.error('[FuelExpenses GET All Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET all fuel expenses for a specific shop / branch
router.get('/shop/:shopId', async (req, res) => {
  try {
    const { shopId } = req.params;
    const { tableName, shopId: realShopId } = await getBranchFuelTable(shopId);

    const [rows] = await pool.query(
      `SELECT * FROM \`${tableName}\` ORDER BY \`expenseDate\` DESC, \`id\` DESC`
    );

    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error('[FuelExpenses GET by Shop Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST add a new fuel expense to the branch table
const handleCreateFuelExpense = async (req, res) => {
  try {
    const rawShopId = req.params.shopId || req.body.shopId || req.query.shopId || 1;
    const { tableName, shopId: realShopId } = await getBranchFuelTable(rawShopId);

    const {
      vehicleNo,
      vehicleName,
      driverName,
      driverPhone,
      purpose,
      fuelType,
      liters,
      ratePerLiter,
      totalAmount,
      paymentMethod,
      paidAmount,
      dueAmount,
      petrolPump,
      odometerReading,
      expenseDate,
      notes,
      createdBy
    } = req.body;

    if (!vehicleNo || totalAmount === undefined || totalAmount === null) {
      return res.status(400).json({ success: false, message: 'Vehicle number and total amount are required' });
    }

    const pMethod = (paymentMethod || 'CASH').toUpperCase();
    const total = Number(totalAmount) || 0;
    let paid = Number(paidAmount);
    let due = Number(dueAmount);

    if (isNaN(paid)) {
      paid = pMethod === 'CREDIT' ? 0 : total;
    }
    if (isNaN(due)) {
      due = pMethod === 'CREDIT' ? total : Math.max(0, total - paid);
    }

    const payload = [
      realShopId,
      vehicleNo.trim(),
      vehicleName ? vehicleName.trim() : '',
      driverName ? driverName.trim() : '',
      driverPhone ? driverPhone.trim() : '',
      purpose ? purpose.trim() : 'Stock Purchase Transport',
      fuelType ? fuelType.trim() : 'Diesel',
      Number(liters) || 0,
      Number(ratePerLiter) || 0,
      total,
      pMethod,
      paid,
      due,
      petrolPump ? petrolPump.trim() : '',
      odometerReading ? odometerReading.trim() : '',
      expenseDate ? new Date(expenseDate) : new Date(),
      notes ? notes.trim() : '',
      createdBy || 'Shop Admin'
    ];

    const [result] = await pool.query(
      `INSERT INTO \`${tableName}\`
        (\`shopId\`, \`vehicleNo\`, \`vehicleName\`, \`driverName\`, \`driverPhone\`, \`purpose\`, \`fuelType\`, \`liters\`, \`ratePerLiter\`, \`totalAmount\`, \`paymentMethod\`, \`paidAmount\`, \`dueAmount\`, \`petrolPump\`, \`odometerReading\`, \`expenseDate\`, \`notes\`, \`createdBy\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      payload
    );

    const [newRow] = await pool.query(`SELECT * FROM \`${tableName}\` WHERE \`id\` = ?`, [result.insertId]);
    res.status(201).json({ success: true, data: newRow[0] });
  } catch (error) {
    console.error('[FuelExpense Create Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

router.post('/', handleCreateFuelExpense);
router.post('/shop/:shopId', handleCreateFuelExpense);

// PUT update a fuel expense by ID across branch tables
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      vehicleNo,
      vehicleName,
      driverName,
      driverPhone,
      purpose,
      fuelType,
      liters,
      ratePerLiter,
      totalAmount,
      paymentMethod,
      paidAmount,
      dueAmount,
      petrolPump,
      odometerReading,
      expenseDate,
      notes,
      createdBy,
      shopId
    } = req.body;

    const updates = [];
    const params = [];

    if (shopId !== undefined) {
      const realShopId = await resolveShopId(shopId);
      updates.push('`shopId` = ?');
      params.push(realShopId);
    }
    if (vehicleNo !== undefined) {
      updates.push('`vehicleNo` = ?');
      params.push(vehicleNo.trim());
    }
    if (vehicleName !== undefined) {
      updates.push('`vehicleName` = ?');
      params.push(vehicleName.trim());
    }
    if (driverName !== undefined) {
      updates.push('`driverName` = ?');
      params.push(driverName.trim());
    }
    if (driverPhone !== undefined) {
      updates.push('`driverPhone` = ?');
      params.push(driverPhone.trim());
    }
    if (purpose !== undefined) {
      updates.push('`purpose` = ?');
      params.push(purpose.trim());
    }
    if (fuelType !== undefined) {
      updates.push('`fuelType` = ?');
      params.push(fuelType.trim());
    }
    if (liters !== undefined) {
      updates.push('`liters` = ?');
      params.push(Number(liters) || 0);
    }
    if (ratePerLiter !== undefined) {
      updates.push('`ratePerLiter` = ?');
      params.push(Number(ratePerLiter) || 0);
    }
    if (totalAmount !== undefined) {
      updates.push('`totalAmount` = ?');
      params.push(Number(totalAmount) || 0);
    }
    if (paymentMethod !== undefined) {
      updates.push('`paymentMethod` = ?');
      params.push(String(paymentMethod).toUpperCase());
    }
    if (paidAmount !== undefined) {
      updates.push('`paidAmount` = ?');
      params.push(Number(paidAmount) || 0);
    }
    if (dueAmount !== undefined) {
      updates.push('`dueAmount` = ?');
      params.push(Number(dueAmount) || 0);
    }
    if (petrolPump !== undefined) {
      updates.push('`petrolPump` = ?');
      params.push(petrolPump.trim());
    }
    if (odometerReading !== undefined) {
      updates.push('`odometerReading` = ?');
      params.push(odometerReading.trim());
    }
    if (expenseDate !== undefined) {
      updates.push('`expenseDate` = ?');
      params.push(new Date(expenseDate));
    }
    if (notes !== undefined) {
      updates.push('`notes` = ?');
      params.push(notes.trim());
    }
    if (createdBy !== undefined) {
      updates.push('`createdBy` = ?');
      params.push(createdBy.trim());
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    // Determine target branch tables
    const branchPrefixes = ALL_BRANCH_PREFIXES || ['peshawar_branch', 'mardan_branch', 'attock_branch'];
    let updatedRow = null;

    // Search and update in the specific branch table that contains this ID
    for (const pfx of branchPrefixes) {
      const tName = `${pfx}__fuel_expenses`;
      await ensureBranchFuelTable(tName);
      try {
        const [exists] = await pool.query(`SELECT id FROM \`${tName}\` WHERE \`id\` = ?`, [id]);
        if (exists.length > 0) {
          await pool.query(`UPDATE \`${tName}\` SET ${updates.join(', ')} WHERE \`id\` = ?`, [...params, id]);
          const [row] = await pool.query(`SELECT * FROM \`${tName}\` WHERE \`id\` = ?`, [id]);
          updatedRow = row[0];
          break;
        }
      } catch (_) {}
    }

    res.json({ success: true, data: updatedRow });
  } catch (error) {
    console.error('[FuelExpense PUT Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE a fuel expense by ID across branch tables
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const branchPrefixes = ALL_BRANCH_PREFIXES || ['peshawar_branch', 'mardan_branch', 'attock_branch'];

    for (const pfx of branchPrefixes) {
      const tName = `${pfx}__fuel_expenses`;
      try {
        await pool.query(`DELETE FROM \`${tName}\` WHERE \`id\` = ?`, [id]);
      } catch (_) {}
    }

    res.json({ success: true, message: 'Fuel expense deleted successfully' });
  } catch (error) {
    console.error('[FuelExpense DELETE Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
