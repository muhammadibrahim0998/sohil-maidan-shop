import pool from '../config/mysql.js';
import fs from 'fs';
import bcrypt from 'bcryptjs';

async function run() {
  console.log('🚀 Setting up superadmin tables in MySQL and updating phpMyAdmin config...');

  // 1. Update phpMyAdmin config.inc.php with MaxNavigationItems = 500
  const pmaPath = 'C:\\xamm20\\phpMyAdmin\\config.inc.php';
  try {
    if (fs.existsSync(pmaPath)) {
      let content = fs.readFileSync(pmaPath, 'utf8');
      content = content.replace(/\$cfg\['MaxNavigationItems'\].*;/g, '');
      content = content.replace(/\$cfg\['FirstLevelNavigationItems'\].*;/g, '');
      content = content.replace(/\$cfg\['MaxTableList'\].*;/g, '');
      
      const pmaSettings = `
$cfg['MaxNavigationItems'] = 500;
$cfg['FirstLevelNavigationItems'] = 500;
$cfg['MaxTableList'] = 500;
$cfg['NavigationTreeTableLevel'] = 500;
`;
      if (content.includes('?>')) {
        content = content.replace('?>', `${pmaSettings}\n?>`);
      } else {
        content += pmaSettings;
      }
      fs.writeFileSync(pmaPath, content, 'utf8');
      console.log('✅ phpMyAdmin config updated: MaxNavigationItems = 500');
    }
  } catch (err) {
    console.warn('phpMyAdmin config update warning:', err.message);
  }

  // 2. Ensure `super_admin` table
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
      \`accessLevel\` VARCHAR(100) DEFAULT 'ALL_PERMISSIONS (Full SuperAdmin Access)',
      \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    INSERT INTO \`super_admin\` (id, fullName, username, email, password, role, phone, address, status, accessLevel)
    VALUES (1, 'System Super Admin', 'Mainyet123@gmail.com', 'Mainyet123@gmail.com', 'super123456', 'super_admin', '+923098216202', 'Main Head Office, Pakistan', 'active', 'ALL_PERMISSIONS (Full SuperAdmin Access)')
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
  console.log('✅ Updated `super_admin` table');

  // 3. Ensure `superadmin` table (without underscore, just in case)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`superadmin\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`fullName\` VARCHAR(255) NOT NULL DEFAULT 'System Super Admin',
      \`username\` VARCHAR(100) NOT NULL DEFAULT 'Mainyet123@gmail.com',
      \`email\` VARCHAR(255) NOT NULL DEFAULT 'Mainyet123@gmail.com',
      \`password\` VARCHAR(255) NOT NULL DEFAULT 'super123456',
      \`role\` VARCHAR(50) NOT NULL DEFAULT 'super_admin',
      \`phone\` VARCHAR(50) DEFAULT '+923098216202',
      \`status\` VARCHAR(50) DEFAULT 'active',
      \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    INSERT INTO \`superadmin\` (id, fullName, username, email, password, role, phone, status)
    VALUES (1, 'System Super Admin', 'Mainyet123@gmail.com', 'Mainyet123@gmail.com', 'super123456', 'super_admin', '+923098216202', 'active')
    ON DUPLICATE KEY UPDATE
      fullName = VALUES(fullName),
      username = VALUES(username),
      email = VALUES(email),
      password = VALUES(password),
      role = VALUES(role),
      phone = VALUES(phone),
      status = VALUES(status)
  `);
  console.log('✅ Updated `superadmin` table');

  // 4. Ensure `user` table (singular)
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
  console.log('✅ Updated `user` table');

  // 5. Ensure `users` table
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
  console.log('✅ Updated `users` table');

  // 6. Verify table list in database
  const [tables] = await pool.query('SHOW TABLES');
  console.log('\n--- 📋 ALL TABLES NOW IN online_pos_software ---');
  const tList = tables.map(r => Object.values(r)[0]);
  console.log(tList.filter(t => !t.includes('__')));

  process.exit(0);
}

run();
