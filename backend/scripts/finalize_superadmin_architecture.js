import pool from '../config/mysql.js';
import bcrypt from 'bcryptjs';

async function run() {
  console.log('🚀 Finalizing Super Admin separate architecture...');

  // 1. Remove Super Admin from `shops` table so it is NEVER listed as a branch
  await pool.query("DELETE FROM `shops` WHERE id = 4 OR LOWER(name) LIKE '%super admin%'");
  await pool.query("DELETE FROM `settings` WHERE shopId = 4");
  console.log('✅ Removed Super Admin from `shops` table (shops now contains only actual branches)');

  // 2. Ensure dedicated `super_admin` table exists outside of branches
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`super_admin\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`fullName\` VARCHAR(255) NOT NULL DEFAULT 'System Super Admin',
      \`username\` VARCHAR(100) NOT NULL DEFAULT 'Mainyet123@gmail.com',
      \`email\` VARCHAR(255) NOT NULL DEFAULT 'Mainyet123@gmail.com',
      \`password\` VARCHAR(255) NOT NULL DEFAULT 'super123456',
      \`role\` VARCHAR(50) NOT NULL DEFAULT 'super_admin',
      \`phone\` VARCHAR(50) DEFAULT '+923098216202',
      \`address\` TEXT DEFAULT 'Main Head Office, Pakistan',
      \`status\` VARCHAR(50) DEFAULT 'active',
      \`accessLevel\` VARCHAR(100) DEFAULT 'MASTER_SUPERADMIN_FULL_CONTROL',
      \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Insert or update in `super_admin` table
  await pool.query(`
    INSERT INTO \`super_admin\` (id, fullName, username, email, password, role, phone, address, status, accessLevel)
    VALUES (1, 'System Super Admin', 'Mainyet123@gmail.com', 'Mainyet123@gmail.com', 'super123456', 'super_admin', '+923098216202', 'Main Head Office, Pakistan', 'active', 'MASTER_SUPERADMIN_FULL_CONTROL')
    ON DUPLICATE KEY UPDATE 
      fullName = VALUES(fullName),
      username = VALUES(username),
      email = VALUES(email),
      password = VALUES(password),
      role = VALUES(role),
      phone = VALUES(phone),
      address = VALUES(address),
      status = VALUES(status),
      accessLevel = VALUES(accessLevel)
  `);
  console.log('✅ Dedicated `super_admin` table updated and ready');

  // 3. Ensure Super Admin in `users` table has shopId = NULL (outside branches)
  const hashedPassword = await bcrypt.hash('super123456', 10);
  await pool.query(`
    UPDATE \`users\` SET 
      username = 'Mainyet123@gmail.com',
      email = 'Mainyet123@gmail.com',
      fullName = 'System Super Admin',
      password = ?,
      plainPassword = 'super123456',
      phoneNumber = '+923098216202',
      shopId = NULL,
      status = 'active'
    WHERE role = 'super_admin'
  `, [hashedPassword]);
  console.log('✅ Updated `users` table: Super Admin has shopId = NULL (independent of branches)');

  // 4. Verification prints
  console.log('\n--- 📋 DEDICATED `super_admin` TABLE ---');
  const [sa] = await pool.query('SELECT * FROM `super_admin`');
  console.log(sa);

  console.log('\n--- 📋 BRANCH SHOPS TABLE (`shops`) ---');
  const [shops] = await pool.query('SELECT id, name, ownerFullName, ownerEmail, superAdminEmail, superAdminPassword FROM `shops`');
  console.log(shops);

  console.log('\n--- 📋 USERS TABLE ---');
  const [users] = await pool.query('SELECT id, username, email, role, shopId, plainPassword FROM `users`');
  console.log(users);

  console.log('\n🎉 ALL ARCHITECTURE UPDATES APPLIED SUCCESSFULLY!');
  process.exit(0);
}

run();
