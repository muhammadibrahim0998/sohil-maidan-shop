import pool from '../config/mysql.js';

async function run() {
  console.log('🗑️ Dropping extra tables: superadmin, super_admin, system_updates, user...');

  await pool.query('DROP TABLE IF EXISTS `superadmin`');
  await pool.query('DROP TABLE IF EXISTS `super_admin`');
  await pool.query('DROP TABLE IF EXISTS `system_updates`');
  await pool.query('DROP TABLE IF EXISTS `user`');

  console.log('✅ Tables dropped successfully.');

  // Verify remaining tables
  const [tables] = await pool.query('SHOW TABLES');
  const tList = tables.map(r => Object.values(r)[0]);
  console.log('\n--- 📋 REMAINING TABLES IN online_pos_software ---');
  console.log(tList.filter(t => !t.includes('__')));

  // Verify users table content
  console.log('\n--- 📋 USERS IN `users` TABLE ---');
  const [users] = await pool.query('SELECT id, username, email, role, shopId, plainPassword FROM `users`');
  console.log(users);

  process.exit(0);
}

run();
