import pool from '../config/mysql.js';

async function run() {
  await pool.query("DELETE FROM `shops` WHERE id = 4 OR name LIKE '%Super Admin%'");
  await pool.query("DELETE FROM `settings` WHERE shopId = 4");
  const [rows] = await pool.query('SELECT id, name, ownerFullName, ownerEmail, superAdminEmail, superAdminPassword FROM `shops`');
  console.log('Shops in database now:', rows);
  process.exit(0);
}

run();
