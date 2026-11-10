import pool from '../config/mysql.js';
import bcrypt from 'bcryptjs';

async function run() {
  try {
    console.log('🚀 Updating database with strict password: super123456...');

    // 1. Create / update dedicated `super_admin` table
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

    // Update or insert into super_admin table
    const [existingSa] = await pool.query("SELECT id FROM `super_admin` WHERE email = 'Mainyet123@gmail.com' OR id = 1");
    if (existingSa.length > 0) {
      await pool.query(`
        UPDATE \`super_admin\` SET
          \`fullName\` = 'System Super Admin',
          \`username\` = 'Mainyet123@gmail.com',
          \`email\` = 'Mainyet123@gmail.com',
          \`password\` = 'super123456',
          \`role\` = 'super_admin',
          \`phone\` = '+923098216202',
          \`address\` = 'Main Head Office, Pakistan',
          \`status\` = 'active',
          \`accessLevel\` = 'ALL_PERMISSIONS (Full SuperAdmin Access)'
        WHERE id = ?
      `, [existingSa[0].id]);
    } else {
      await pool.query(`
        INSERT INTO \`super_admin\` (id, fullName, username, email, password, role, phone, address, status, accessLevel)
        VALUES (1, 'System Super Admin', 'Mainyet123@gmail.com', 'Mainyet123@gmail.com', 'super123456', 'super_admin', '+923098216202', 'Main Head Office, Pakistan', 'active', 'ALL_PERMISSIONS (Full SuperAdmin Access)')
      `);
    }
    console.log('✅ Updated `super_admin` table: password is super123456');

    // 2. Ensure `plainPassword` in `users` table
    const [userCols] = await pool.query('DESCRIBE `users`');
    const userColSet = new Set(userCols.map(c => c.Field));
    if (!userColSet.has('plainPassword')) {
      await pool.query("ALTER TABLE `users` ADD COLUMN `plainPassword` VARCHAR(255) DEFAULT NULL AFTER `password`");
    }

    // Update users table
    const hashedPassword = await bcrypt.hash('super123456', 10);
    await pool.query(`
      UPDATE \`users\` SET 
        username = 'Mainyet123@gmail.com',
        email = 'Mainyet123@gmail.com',
        fullName = 'System Super Admin',
        password = ?,
        plainPassword = 'super123456',
        phoneNumber = '+923098216202',
        status = 'active'
      WHERE role = 'super_admin'
    `, [hashedPassword]);
    console.log('✅ Updated `users` table: password hash and plainPassword are super123456');

    // 3. Update shops table
    await pool.query("UPDATE `shops` SET `superAdminEmail` = 'Mainyet123@gmail.com', `superAdminPassword` = 'super123456'");
    await pool.query("UPDATE `shops` SET `ownerPassword` = 'super123456' WHERE id = 4");
    console.log('✅ Updated `shops` table: superAdminPassword is super123456');

    // 4. Update settings table for shop 4
    await pool.query("UPDATE `settings` SET `ownerPassword` = 'super123456' WHERE shopId = 4");
    console.log('✅ Updated `settings` table for shop 4');

    console.log('\n--- 📋 VERIFICATION: super_admin TABLE ---');
    const [saRows] = await pool.query('SELECT * FROM `super_admin`');
    console.log(saRows);

    console.log('\n--- 📋 VERIFICATION: shops TABLE ---');
    const [shopRows] = await pool.query('SELECT id, name, ownerEmail, superAdminEmail, superAdminPassword FROM `shops`');
    console.log(shopRows);

    console.log('\n--- 📋 VERIFICATION: users TABLE ---');
    const [uRows] = await pool.query("SELECT id, username, email, fullName, role, plainPassword FROM `users` WHERE role = 'super_admin'");
    console.log(uRows);

    console.log('\n🎉 ALL UPDATES FINISHED!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
