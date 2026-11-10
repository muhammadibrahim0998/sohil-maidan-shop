import pool from '../config/mysql.js';

export async function up() {
  console.log('Running migration: Create vendors table');
  const query = `
    CREATE TABLE IF NOT EXISTS vendors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shopId INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) DEFAULT '',
      location VARCHAR(255) DEFAULT '',
      isActive BOOLEAN DEFAULT TRUE,
      archivedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_vendor_shop_name (shopId, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  try {
    await pool.query(query);
    // Add columns if table already existed without them
    const [columns] = await pool.query("SHOW COLUMNS FROM vendors LIKE 'isActive'");
    if (columns.length === 0) {
      await pool.query('ALTER TABLE vendors ADD COLUMN isActive BOOLEAN DEFAULT TRUE, ADD COLUMN archivedAt TIMESTAMP NULL');
    }
    // Add unique key if table already existed without it
    const [indexes] = await pool.query("SHOW INDEX FROM vendors WHERE Key_name = 'uq_vendor_shop_name'");
    if (indexes.length === 0) {
      await pool.query('ALTER TABLE vendors ADD UNIQUE KEY uq_vendor_shop_name (shopId, name)');
    }
    console.log('Migration successful: vendors table created/verified.');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('02_create_vendors_table.js')) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}
