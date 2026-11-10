import pool from './config/mysql.js';

const ALL_BRANCH_PREFIXES = [
  { shopId: 1, prefix: 'peshawar_branch' },
  { shopId: 2, prefix: 'mardan_branch' },
  { shopId: 3, prefix: 'attock_branch' }
];

export async function initPurchaseCreditTables() {
  console.log('🚀 Creating/Verifying Purchase Credit tables for all branches...');

  const createTableSql = (tableName) => `
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shopId INT NOT NULL DEFAULT 1,
      itemId INT DEFAULT NULL,
      purchaseId INT DEFAULT NULL,
      vendorId INT DEFAULT NULL,
      productName VARCHAR(255) NOT NULL,
      supplierName VARCHAR(255) NOT NULL,
      supplierPhone VARCHAR(100) DEFAULT '',
      supplierLocation VARCHAR(255) DEFAULT '',
      quantityText VARCHAR(100) DEFAULT '',
      totalCost DECIMAL(12,2) DEFAULT 0,
      paidToDate DECIMAL(12,2) DEFAULT 0,
      pendingDue DECIMAL(12,2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'UNPAID',
      paymentMethod VARCHAR(50) DEFAULT 'Credit',
      paymentReceipt TEXT,
      notes TEXT,
      lastSettlementDate DATETIME DEFAULT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_pc_shop (shopId),
      KEY idx_pc_item (itemId),
      KEY idx_pc_vendor (vendorId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // 1. Drop flat table outside branches if exists
  try {
    await pool.query('DROP TABLE IF EXISTS `purchase_credits`');
  } catch (_) {}

  // 2. Create branch tables
  for (const b of ALL_BRANCH_PREFIXES) {
    const table = `${b.prefix}__purchase_credits`;
    try {
      await pool.query(createTableSql(table));
      console.log(`✅ Created/verified table: ${table}`);
    } catch (err) {
      console.error(`Error creating ${table}:`, err.message);
    }
  }

  // 3. Populate items with dueAmountToSupplier > 0 into branch purchase_credits tables if missing
  for (const b of ALL_BRANCH_PREFIXES) {
    const itemTable = `${b.prefix}__items`;
    const pcTable = `${b.prefix}__purchase_credits`;

    try {
      const [items] = await pool.query(
        `SELECT * FROM \`${itemTable}\` WHERE dueAmountToSupplier > 0 OR (totalPurchaseCost > 0 AND amountPaidToSupplier < totalPurchaseCost)`
      );
      for (const it of items) {
        const total = Number(it.totalPurchaseCost || 0);
        const paid = Number(it.amountPaidToSupplier || 0);
        const due = (it.dueAmountToSupplier !== undefined && it.dueAmountToSupplier !== null)
          ? Number(it.dueAmountToSupplier)
          : Math.max(0, total - paid);

        if (due > 0 || paid > 0) {
          const status = due <= 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID');

          const qtyStr = [
            it.petiQuantity > 0 ? `${it.petiQuantity} Petis` : '',
            it.trayQuantity > 0 ? `${it.trayQuantity} Trays` : '',
            it.eggQuantity > 0 ? `${it.eggQuantity} Eggs` : ''
          ].filter(Boolean).join(', ') || (it.stock ? `${it.stock} Stock` : '0');

          const [existing] = await pool.query(`SELECT id FROM \`${pcTable}\` WHERE itemId = ?`, [it.id]);
          if (!existing || existing.length === 0) {
            await pool.query(
              `INSERT INTO \`${pcTable}\` (shopId, itemId, productName, supplierName, supplierPhone, supplierLocation, quantityText, totalCost, paidToDate, pendingDue, status, paymentMethod, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                b.shopId,
                it.id,
                it.name || 'Egg Product',
                it.supplierName || 'Egg Supplier',
                it.supplierPhone || '',
                it.supplierLocation || '',
                qtyStr,
                total,
                paid,
                due,
                status,
                it.paymentMethod || 'Credit',
                it.createdAt || new Date()
              ]
            );
            console.log(`  ➕ Synced supplier credit for item ID ${it.id} (${it.name}) into ${pcTable}`);
          } else {
            await pool.query(
              `UPDATE \`${pcTable}\` SET productName = ?, supplierName = ?, supplierPhone = ?, supplierLocation = ?, quantityText = ?, totalCost = ?, paidToDate = ?, pendingDue = ?, status = ?, updatedAt = NOW() WHERE itemId = ?`,
              [
                it.name || 'Egg Product',
                it.supplierName || 'Egg Supplier',
                it.supplierPhone || '',
                it.supplierLocation || '',
                qtyStr,
                total,
                paid,
                due,
                status,
                it.id
              ]
            );
          }
        }
      }
    } catch (err) {
      console.error(`Error syncing items for ${itemTable}:`, err.message);
    }
  }

  console.log('🎉 All Purchase Credit branch tables setup & synced successfully!');
}

if (process.argv[1] && process.argv[1].endsWith('create_purchase_credits_tables.js')) {
  initPurchaseCreditTables().then(() => process.exit(0));
}
