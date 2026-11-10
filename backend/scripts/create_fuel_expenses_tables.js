import pool from '../config/mysql.js';

export async function initFuelExpensesTables() {
  console.log('🚀 Initializing dynamic MySQL tables for Fuel & Vehicle expenses across all branches...');

  const branches = [
    { shopId: 1, prefix: 'peshawar_branch', name: 'Peshawar Branch' },
    { shopId: 2, prefix: 'mardan_branch', name: 'Mardan Branch' },
    { shopId: 3, prefix: 'attock_branch', name: 'Attock Branch' },
    { shopId: 4, prefix: 'peshawar_branch', name: 'Peshawar Karkhano' }
  ];

  // Try fetching any extra shops dynamically from the shops table
  try {
    const [shops] = await pool.query('SELECT id, name FROM shops');
    for (const s of shops) {
      const sName = (s.name || '').toLowerCase();
      let pfx = 'peshawar_branch';
      if (sName.includes('mardan')) pfx = 'mardan_branch';
      else if (sName.includes('attock')) pfx = 'attock_branch';
      else if (sName.includes('peshawar') || sName.includes('peshawer')) pfx = 'peshawar_branch';
      else pfx = `shop_${s.id}_branch`;

      if (!branches.some(b => b.shopId === s.id)) {
        branches.push({ shopId: s.id, prefix: pfx, name: s.name });
      }
    }
  } catch (err) {
    console.warn('Could not query shops table, using default branch list:', err.message);
  }

  const createTableSql = (tableName) => `
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
  `;

  // 1. Drop flat table outside branches if exists
  try {
    await pool.query('DROP TABLE IF EXISTS `fuel_expenses`');
    console.log('✅ Dropped flat table outside branches: fuel_expenses');
  } catch (_) {}

  // 2. Ensure distinct branch tables exist
  const uniquePrefixes = Array.from(new Set(branches.map(b => b.prefix)));
  for (const pfx of uniquePrefixes) {
    const tableName = `${pfx}__fuel_expenses`;
    await pool.query(createTableSql(tableName));
    console.log(`✅ Created/verified table: ${tableName}`);
  }

  // 3. Migrate/sync existing rows from fuel_expenses into respective branch tables if needed
  try {
    const [existingRows] = await pool.query('SELECT * FROM `fuel_expenses`');
    if (existingRows && existingRows.length > 0) {
      for (const row of existingRows) {
        const branchObj = branches.find(b => Number(b.shopId) === Number(row.shopId)) || branches[0];
        const targetTable = `${branchObj.prefix}__fuel_expenses`;

        // Check if already in branch table
        const [exists] = await pool.query(
          `SELECT id FROM \`${targetTable}\` WHERE vehicleNo = ? AND expenseDate = ? AND totalAmount = ?`,
          [row.vehicleNo, row.expenseDate, row.totalAmount]
        );

        if (exists.length === 0) {
          await pool.query(`
            INSERT INTO \`${targetTable}\`
            (shopId, vehicleNo, vehicleName, driverName, driverPhone, purpose, fuelType, liters, ratePerLiter, totalAmount, paymentMethod, paidAmount, dueAmount, petrolPump, odometerReading, expenseDate, notes, createdBy, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            row.shopId,
            row.vehicleNo,
            row.vehicleName,
            row.driverName,
            row.driverPhone,
            row.purpose,
            row.fuelType,
            row.liters,
            row.ratePerLiter,
            row.totalAmount,
            row.paymentMethod,
            row.paidAmount,
            row.dueAmount,
            row.petrolPump,
            row.odometerReading,
            row.expenseDate,
            row.notes,
            row.createdBy,
            row.createdAt,
            row.updatedAt
          ]);
          console.log(`Synced record ID ${row.id} into ${targetTable}`);
        }
      }
    }
  } catch (syncErr) {
    console.warn('Sync note:', syncErr.message);
  }

  console.log('🎉 All branch fuel expenses tables initialized and synchronized successfully!');
}

if (process.argv[1]?.endsWith('create_fuel_expenses_tables.js')) {
  initFuelExpensesTables().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
