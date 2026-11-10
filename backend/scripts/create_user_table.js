import pool from '../config/mysql.js';
import bcrypt from 'bcryptjs';

async function run() {
  console.log('🚀 Creating / updating `user` table and ensuring Super Admin credentials...');

  // 1. Create `user` table (singular)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`user\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`fullName\` VARCHAR(255) NOT NULL DEFAULT 'System Super Admin',
      \`username\` VARCHAR(100) NOT NULL DEFAULT 'Mainyet123@gmail.com',
      \`email\` VARCHAR(255) NOT NULL DEFAULT 'Mainyet123@gmail.com',
      \`password\` VARCHAR(255) NOT NULL DEFAULT 'super123456',
      \`plainPassword\` VARCHAR(255) NOT NULL DEFAULT 'super123456',
      \`role\` VARCHAR(50) NOT NULL DEFAULT 'super_admin',
      \`contactNumber\` VARCHAR(50) DEFAULT '+923098216202',
      \`status\` VARCHAR(50) DEFAULT 'active',
      \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Insert or update Super Admin in `user` table
  await pool.query(`
    INSERT INTO \`user\` (id, fullName, username, email, password, plainPassword, role, contactNumber, status)
    VALUES (1, 'System Super Admin', 'Mainyet123@gmail.com', 'Mainyet123@gmail.com', 'super123456', 'super123456', 'super_admin', '+923098216202', 'active')
    ON DUPLICATE KEY UPDATE 
      fullName = VALUES(fullName),
      username = VALUES(username),
      email = VALUES(email),
      password = VALUES(password),
      plainPassword = VALUES(plainPassword),
      role = VALUES(role),
      contactNumber = VALUES(contactNumber),
      status = VALUES(status)
  `);
  console.log('✅ Created / verified `user` table with Super Admin credentials');

  // 2. Ensure `users` table (plural) has Super Admin credentials properly set
  const hash = await bcrypt.hash('super123456', 10);
  await pool.query(`
    UPDATE \`users\` SET 
      username = 'Mainyet123@gmail.com',
      email = 'Mainyet123@gmail.com',
      fullName = 'System Super Admin',
      password = ?,
      plainPassword = 'super123456',
      role = 'super_admin',
      shopId = NULL,
      status = 'active'
    WHERE role = 'super_admin'
  `, [hash]);
  console.log('✅ Updated `users` table with Super Admin credentials');

  // 3. Print verification
  console.log('\n--- 📋 `user` TABLE (Singular) ---');
  const [userSingle] = await pool.query('SELECT * FROM `user`');
  console.log(userSingle);

  console.log('\n--- 📋 `users` TABLE (Plural) ---');
  const [usersPlural] = await pool.query("SELECT id, username, email, role, shopId, plainPassword FROM `users` WHERE role = 'super_admin'");
  console.log(usersPlural);

  console.log('\n--- 📋 `super_admin` TABLE ---');
  const [sa] = await pool.query('SELECT id, fullName, email, password, role FROM `super_admin`');
  console.log(sa);

  console.log('\n🎉 DONE!');
  process.exit(0);
}

run();
