import pool from './config/mysql.js';

const ALL_BRANCH_PREFIXES = [
  { shopId: 1, prefix: 'peshawar_branch' },
  { shopId: 2, prefix: 'mardan_branch' },
  { shopId: 3, prefix: 'attock_branch' }
];

export async function initCustomerCreditTables() {
  console.log('🚀 Creating/Verifying Customer Credit tables for all branches...');

  const createTableSql = (tableName) => `
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shopId INT NOT NULL DEFAULT 1,
      customerId INT DEFAULT NULL,
      saleId INT DEFAULT NULL,
      customerName VARCHAR(255) NOT NULL,
      customerPhone VARCHAR(100) DEFAULT '',
      customerEmail VARCHAR(255) DEFAULT '',
      totalAmount DECIMAL(12,2) DEFAULT 0,
      paidAmount DECIMAL(12,2) DEFAULT 0,
      dueAmount DECIMAL(12,2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'UNPAID',
      notes TEXT,
      paymentMethod VARCHAR(50) DEFAULT 'CASH',
      transactionId VARCHAR(255) DEFAULT '',
      paymentProof TEXT,
      lastPaymentDate DATETIME DEFAULT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_cc_shop (shopId),
      KEY idx_cc_cust (customerId),
      KEY idx_cc_sale (saleId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // 1. Drop flat table outside branches if exists
  try {
    await pool.query('DROP TABLE IF EXISTS `customer_credits`');
  } catch (_) {}

  // 2. Create branch tables
  for (const b of ALL_BRANCH_PREFIXES) {
    const table = `${b.prefix}__customer_credits`;
    try {
      await pool.query(createTableSql(table));
      console.log(`✅ Created/verified table: ${table}`);
    } catch (err) {
      console.error(`Error creating ${table}:`, err.message);
    }
  }

  // 3. Populate credit sales into branch tables if missing
  for (const b of ALL_BRANCH_PREFIXES) {
    const saleTable = `${b.prefix}__sales`;
    const ccTable = `${b.prefix}__customer_credits`;

    try {
      const [sales] = await pool.query(`SELECT * FROM \`${saleTable}\` WHERE dueAmount > 0 OR isCredit = 1`);
      for (const s of sales) {
        const [existing] = await pool.query(`SELECT id FROM \`${ccTable}\` WHERE saleId = ? OR (customerName = ? AND dueAmount = ?)`, [s.id, s.customerName, s.dueAmount]);
        if (!existing || existing.length === 0) {
          const total = Number(s.totalAmount || 0);
          const paid = Number(s.cashPaid || 0) + Number(s.bankPaid || 0);
          const due = Number(s.dueAmount || 0);
          const status = due <= 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID');

          await pool.query(
            `INSERT INTO \`${ccTable}\` (shopId, customerId, saleId, customerName, customerPhone, customerEmail, totalAmount, paidAmount, dueAmount, status, notes, paymentMethod, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              b.shopId,
              s.customerId || null,
              s.id,
              s.customerName || 'Credit Customer',
              s.customerPhone || '',
              s.customerEmail || '',
              total,
              paid,
              due,
              status,
              s.invoiceNumber || '',
              s.paymentMethod || 'CASH',
              s.saleDate || s.createdAt || new Date()
            ]
          );
          console.log(`  ➕ Synced credit sale ID ${s.id} (${s.customerName}) into ${ccTable}`);
        }
      }
    } catch (err) {
      console.error(`Error syncing sales for ${saleTable}:`, err.message);
    }
  }

  console.log('🎉 All Customer Credit branch tables setup successfully!');
}

if (process.argv[1] && process.argv[1].endsWith('create_customer_credits_tables.js')) {
  initCustomerCreditTables().then(() => process.exit(0));
}
