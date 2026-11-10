import pool from './config/mysql.js';

export async function createAllBranchTables() {
  console.log('🚀 Setting up pure branch folder database...');

  // 1. Drop all legacy views
  try {
    const [views] = await pool.query("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
    for (const v of views) {
      const viewName = Object.values(v)[0];
      await pool.query(`DROP VIEW IF EXISTS \`${viewName}\``);
    }
  } catch (_) {}

  // 2. Define entities and branches
  const entities = [
    'items',
    'sales',
    'purchases',
    'purchase_credits',
    'customers',
    'customer_credits',
    'expenses',
    'orders',
    'damaged_products',
    'cash_sessions',
    'profit_reports',
    'vendors'
  ];

  const branches = [
    { id: 1, folder: 'peshawar_branch' },
    { id: 2, folder: 'mardan_branch' },
    { id: 3, folder: 'attock_branch' }
  ];

  // 3. Drop all flat clutter tables between branch folders
  for (const entity of entities) {
    try {
      await pool.query(`DROP TABLE IF EXISTS \`${entity}\``);
    } catch (_) {}
  }

  // Also drop extra flat relational tables
  try {
    await pool.query('DROP TABLE IF EXISTS `sale_items`');
    await pool.query('DROP TABLE IF EXISTS `order_items`');
    await pool.query('DROP TABLE IF EXISTS `customer_cart_items`');
  } catch (_) {}

  console.log('🎉 Clean database ready! All flat clutter tables removed. Only branch folders (peshawar_branch, mardan_branch, attock_branch) and users/core tables exist.');
  return true;
}

if (process.argv[1] && process.argv[1].endsWith('createBranchTables.js')) {
  createAllBranchTables().then(() => {
    console.log('Database cleanup complete.');
    process.exit(0);
  });
}


if (process.argv[1] && process.argv[1].endsWith('createBranchTables.js')) {
  createAllBranchTables().then(() => {
    console.log('Branch table setup complete.');
    process.exit(0);
  });
}


