import mysql from 'mysql2/promise';

const ALL_BRANCH_PREFIXES = ['peshawar_branch', 'mardan_branch', 'attock_branch'];

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'online_pos_software',
    port: process.env.DB_PORT || 3306
  });

  for (const b of ALL_BRANCH_PREFIXES) {
    const table = `${b}__cash_sessions`;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`${table}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shopId INT,
        status VARCHAR(50) DEFAULT 'open',
        openingCash DECIMAL(15,2) DEFAULT 0,
        closingCash DECIMAL(15,2) DEFAULT 0,
        totalSales DECIMAL(15,2) DEFAULT 0,
        totalReturns DECIMAL(15,2) DEFAULT 0,
        expectedCash DECIMAL(15,2) DEFAULT 0,
        actualCash DECIMAL(15,2) DEFAULT 0,
        openedBy VARCHAR(255),
        closedBy VARCHAR(255),
        notes TEXT,
        openedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        closedAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  }
  console.log('Cash session tables created successfully');
  process.exit(0);
}

run().catch(console.error);
