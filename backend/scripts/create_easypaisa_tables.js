import pool from '../config/mysql.js';

async function initEasyPaisaTables() {
  const branches = ['peshawar_branch', 'mardan_branch', 'attock_branch'];
  for (const b of branches) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`${b}__easypaisa\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`shopId\` INT NOT NULL,
        \`orderId\` INT NULL,
        \`customerId\` INT NULL,
        \`customerName\` VARCHAR(255) NULL,
        \`customerPhone\` VARCHAR(50) NULL,
        \`transactionId\` VARCHAR(255) NULL,
        \`senderNumber\` VARCHAR(50) NULL,
        \`amount\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        \`status\` ENUM('PENDING','PAID','FAILED') NOT NULL DEFAULT 'PENDING',
        \`items\` LONGTEXT NULL,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log(`Created table: ${b}__easypaisa`);

    // Sync existing easypaisa orders into the easypaisa table
    const [existingOrders] = await pool.query(`SELECT * FROM \`${b}__orders\` WHERE paymentMethod = 'EASYPAISA'`);
    for (const ord of existingOrders) {
      const [exists] = await pool.query(`SELECT id FROM \`${b}__easypaisa\` WHERE orderId = ?`, [ord.id]);
      if (exists.length === 0) {
        await pool.query(`
          INSERT INTO \`${b}__easypaisa\` 
          (shopId, orderId, customerId, customerName, customerPhone, transactionId, amount, status, items, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          ord.shopId,
          ord.id,
          ord.customerId,
          ord.shippingFullName || 'Customer',
          ord.shippingPhone || '',
          ord.transactionId || '',
          ord.totalAmount || 0,
          ord.paymentStatus || 'PENDING',
          ord.items || '[]',
          ord.createdAt
        ]);
      }
    }
    console.log(`Synced ${existingOrders.length} easypaisa orders into ${b}__easypaisa`);
  }
  console.log('All branch EasyPaisa tables created and synchronized successfully!');
  process.exit(0);
}

initEasyPaisaTables().catch(err => {
  console.error(err);
  process.exit(1);
});
