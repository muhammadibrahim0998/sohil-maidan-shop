import pool from './config/mysql.js';

const ALL_BRANCH_PREFIXES = [
  { shopId: 1, prefix: 'peshawar_branch' },
  { shopId: 2, prefix: 'mardan_branch' },
  { shopId: 3, prefix: 'attock_branch' }
];

export async function initProfitReportTables() {
  console.log('🚀 Creating/Verifying Profit Report tables for all branches...');

  const createTableSql = (tableName) => `
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shopId INT NOT NULL DEFAULT 1,
      reportDate DATE NOT NULL,
      periodType VARCHAR(50) DEFAULT 'DAILY',
      totalSales DECIMAL(12,2) DEFAULT 0,
      totalProfit DECIMAL(12,2) DEFAULT 0,
      totalPurchasesCost DECIMAL(12,2) DEFAULT 0,
      totalExpenses DECIMAL(12,2) DEFAULT 0,
      totalDamagedLoss DECIMAL(12,2) DEFAULT 0,
      netProfit DECIMAL(12,2) DEFAULT 0,
      salesCount INT DEFAULT 0,
      expensesCount INT DEFAULT 0,
      damagedCount INT DEFAULT 0,
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_shop_date_period (shopId, reportDate, periodType),
      KEY idx_pr_shop (shopId),
      KEY idx_pr_date (reportDate)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // 1. Drop flat table outside branches if exists
  try {
    await pool.query('DROP TABLE IF EXISTS `profit_reports`');
  } catch (_) {}

  // 2. Create branch tables
  for (const b of ALL_BRANCH_PREFIXES) {
    const table = `${b.prefix}__profit_reports`;
    try {
      await pool.query(createTableSql(table));
      console.log(`✅ Created/verified table: ${table}`);
    } catch (err) {
      console.error(`Error creating ${table}:`, err.message);
    }
  }

  // 3. Compute and populate daily profit records for each branch from actual sales, expenses, damaged products, items
  for (const b of ALL_BRANCH_PREFIXES) {
    const prTable = `${b.prefix}__profit_reports`;
    const salesTable = `${b.prefix}__sales`;
    const expensesTable = `${b.prefix}__expenses`;
    const damagedTable = `${b.prefix}__damaged_products`;
    const itemsTable = `${b.prefix}__items`;

    try {
      // Get all unique dates
      const [salesDates] = await pool.query(`SELECT DISTINCT DATE(COALESCE(saleDate, createdAt)) as d FROM \`${salesTable}\``);
      const [expDates] = await pool.query(`SELECT DISTINCT DATE(COALESCE(expenseDate, createdAt)) as d FROM \`${expensesTable}\``);
      const [damDates] = await pool.query(`SELECT DISTINCT DATE(COALESCE(damageDate, createdAt)) as d FROM \`${damagedTable}\``);
      const [itemDates] = await pool.query(`SELECT DISTINCT DATE(createdAt) as d FROM \`${itemsTable}\``);

      const dateSet = new Set();
      const addDate = (row) => {
        if (!row || !row.d) return;
        const dStr = new Date(row.d).toISOString().split('T')[0];
        dateSet.add(dStr);
      };

      (salesDates || []).forEach(addDate);
      (expDates || []).forEach(addDate);
      (damDates || []).forEach(addDate);
      (itemDates || []).forEach(addDate);

      // Ensure today's date is also included
      dateSet.add(new Date().toISOString().split('T')[0]);

      for (const dStr of dateSet) {
        // Calculate sales for date
        const [salesRes] = await pool.query(
          `SELECT COUNT(*) as sCount, SUM(totalAmount) as sTotal, SUM(totalProfit) as pTotal FROM \`${salesTable}\` WHERE DATE(COALESCE(saleDate, createdAt)) = ?`,
          [dStr]
        );
        const salesCount = Number(salesRes[0]?.sCount || 0);
        const totalSales = Number(salesRes[0]?.sTotal || 0);
        const totalProfit = Number(salesRes[0]?.pTotal || 0);

        // Calculate purchases cost for date
        const [purchasesRes] = await pool.query(
          `SELECT SUM(totalPurchaseCost) as purTotal FROM \`${itemsTable}\` WHERE DATE(createdAt) = ?`,
          [dStr]
        );
        const totalPurchasesCost = Number(purchasesRes[0]?.purTotal || 0);

        // Calculate expenses for date
        const [expRes] = await pool.query(
          `SELECT COUNT(*) as eCount, SUM(amount) as eTotal FROM \`${expensesTable}\` WHERE DATE(COALESCE(expenseDate, createdAt)) = ?`,
          [dStr]
        );
        const expensesCount = Number(expRes[0]?.eCount || 0);
        const totalExpenses = Number(expRes[0]?.eTotal || 0);

        // Calculate damaged loss for date
        const [damRes] = await pool.query(
          `SELECT COUNT(*) as dCount, SUM(totalLoss) as dTotal FROM \`${damagedTable}\` WHERE DATE(COALESCE(damageDate, createdAt)) = ?`,
          [dStr]
        );
        const damagedCount = Number(damRes[0]?.dCount || 0);
        const totalDamagedLoss = Number(damRes[0]?.dTotal || 0);

        // Net Profit = totalSales - totalPurchasesCost - totalExpenses - totalDamagedLoss
        const netProfit = totalSales - totalPurchasesCost - totalExpenses - totalDamagedLoss;

        await pool.query(
          `INSERT INTO \`${prTable}\` (shopId, reportDate, periodType, totalSales, totalProfit, totalPurchasesCost, totalExpenses, totalDamagedLoss, netProfit, salesCount, expensesCount, damagedCount, notes)
           VALUES (?, ?, 'DAILY', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             totalSales = VALUES(totalSales),
             totalProfit = VALUES(totalProfit),
             totalPurchasesCost = VALUES(totalPurchasesCost),
             totalExpenses = VALUES(totalExpenses),
             totalDamagedLoss = VALUES(totalDamagedLoss),
             netProfit = VALUES(netProfit),
             salesCount = VALUES(salesCount),
             expensesCount = VALUES(expensesCount),
             damagedCount = VALUES(damagedCount),
             updatedAt = NOW()`,
          [
            b.shopId,
            dStr,
            totalSales,
            totalProfit,
            totalPurchasesCost,
            totalExpenses,
            totalDamagedLoss,
            netProfit,
            salesCount,
            expensesCount,
            damagedCount,
            `Daily Profit Summary for ${dStr}`
          ]
        );
      }
      console.log(`  ➕ Synced profit report records for ${b.prefix}`);
    } catch (err) {
      console.error(`Error syncing profit report for ${prTable}:`, err.message);
    }
  }

  console.log('🎉 All Profit Report branch tables setup & synced successfully!');
}

if (process.argv[1] && process.argv[1].endsWith('create_profit_reports_tables.js')) {
  initProfitReportTables().then(() => process.exit(0));
}
