import pool from './config/mysql.js';

export async function initFuelAndBankSchema() {
  console.log('🚀 [Dynamic Migration] Initializing Fuel and Bank tables/columns for live deployment...');

  try {
    // 1. Drop flat fuel tables outside branches if present
    try {
      await pool.query('DROP TABLE IF EXISTS `fuel_expenses`');
      await pool.query('DROP TABLE IF EXISTS `fuel`');
    } catch (_) {}

    // 2. Ensure columns in `shops` table
    try {
      const [shopCols] = await pool.query('DESCRIBE `shops`');
      const existingShopCols = new Set(shopCols.map(c => c.Field));

      if (!existingShopCols.has('bankName')) {
        await pool.query('ALTER TABLE `shops` ADD COLUMN `bankName` VARCHAR(255) NULL AFTER `contactNumber`');
      }
      if (!existingShopCols.has('bankAccountNumber')) {
        await pool.query('ALTER TABLE `shops` ADD COLUMN `bankAccountNumber` VARCHAR(100) NULL AFTER `bankName`');
      }
      if (!existingShopCols.has('bankAccountTitle')) {
        await pool.query('ALTER TABLE `shops` ADD COLUMN `bankAccountTitle` VARCHAR(255) NULL AFTER `bankAccountNumber`');
      }
      if (!existingShopCols.has('easypaisaNumber')) {
        await pool.query('ALTER TABLE `shops` ADD COLUMN `easypaisaNumber` VARCHAR(100) NULL AFTER `bankAccountTitle`');
      }
      if (!existingShopCols.has('isEditApproved')) {
        await pool.query('ALTER TABLE `shops` ADD COLUMN `isEditApproved` TINYINT(1) DEFAULT 1');
      }
      if (!existingShopCols.has('isDeleteApproved')) {
        await pool.query('ALTER TABLE `shops` ADD COLUMN `isDeleteApproved` TINYINT(1) DEFAULT 1');
      }
      if (!existingShopCols.has('approvalStatus')) {
        await pool.query("ALTER TABLE `shops` ADD COLUMN `approvalStatus` VARCHAR(50) DEFAULT 'APPROVED'");
      }
      if (!existingShopCols.has('approvalNotes')) {
        await pool.query('ALTER TABLE `shops` ADD COLUMN `approvalNotes` TEXT NULL');
      }
      if (!existingShopCols.has('allowedPages')) {
        await pool.query('ALTER TABLE `shops` ADD COLUMN `allowedPages` LONGTEXT NULL');
      }
      if (!existingShopCols.has('banksJson')) {
        await pool.query('ALTER TABLE `shops` ADD COLUMN `banksJson` LONGTEXT NULL');
      }
    } catch (err) {
      console.warn('[Migration Warning] shops table columns:', err.message);
    }

    // 3. Ensure columns in `settings` table
    try {
      const [settingCols] = await pool.query('DESCRIBE `settings`');
      const existingSettingCols = new Set(settingCols.map(c => c.Field));

      if (!existingSettingCols.has('bankName')) {
        await pool.query('ALTER TABLE `settings` ADD COLUMN `bankName` VARCHAR(255) NULL AFTER `easypaisaNumber`');
      }
      if (!existingSettingCols.has('bankAccountNumber')) {
        await pool.query('ALTER TABLE `settings` ADD COLUMN `bankAccountNumber` VARCHAR(100) NULL AFTER `bankName`');
      }
      if (!existingSettingCols.has('bankAccountTitle')) {
        await pool.query('ALTER TABLE `settings` ADD COLUMN `bankAccountTitle` VARCHAR(255) NULL AFTER `bankAccountNumber`');
      }
    } catch (err) {
      console.warn('[Migration Warning] settings table columns:', err.message);
    }

    // 4. Ensure branch fuel expense tables for all known branches
    const branchPrefixes = ['peshawar_branch', 'mardan_branch', 'attock_branch'];
    try {
      const [allShops] = await pool.query('SELECT id, name FROM `shops`');
      for (const s of allShops) {
        const sName = (s.name || '').toLowerCase();
        let pfx = 'peshawar_branch';
        if (sName.includes('mardan')) pfx = 'mardan_branch';
        else if (sName.includes('attock')) pfx = 'attock_branch';
        if (!branchPrefixes.includes(pfx)) branchPrefixes.push(pfx);
      }
    } catch (_) {}

    for (const prefix of branchPrefixes) {
      const tName = `${prefix}__fuel_expenses`;
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`${tName}\` (
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
      console.log(`✅ [Migration] Branch fuel table verified: ${tName}`);
    }

    console.log('🎉 [Dynamic Migration] Fuel and Bank schema ready for deployment!');
    return true;
  } catch (err) {
    console.error('❌ [Migration Error]:', err.message);
    return false;
  }
}

if (process.argv[1] && process.argv[1].endsWith('create_fuel_expenses_tables.js')) {
  initFuelAndBankSchema().then(() => {
    console.log('Fuel migration process complete.');
    process.exit(0);
  });
}

export default initFuelAndBankSchema;
