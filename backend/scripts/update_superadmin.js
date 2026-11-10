import pool from '../config/mysql.js';
import bcrypt from 'bcryptjs';

async function run() {
  try {
    // 1. Add columns to shops table if missing
    const [cols] = await pool.query('DESCRIBE `shops`');
    const set = new Set(cols.map(c => c.Field));
    
    if (!set.has('superAdminEmail')) {
      await pool.query("ALTER TABLE `shops` ADD COLUMN `superAdminEmail` VARCHAR(255) DEFAULT 'Mainyet123@gmail.com' AFTER `ownerPhone`");
      console.log('Added superAdminEmail to shops');
    }
    if (!set.has('superAdminPassword')) {
      await pool.query("ALTER TABLE `shops` ADD COLUMN `superAdminPassword` VARCHAR(255) DEFAULT 'super123456.' AFTER `superAdminEmail`");
      console.log('Added superAdminPassword to shops');
    }
    if (!set.has('ownerPassword')) {
      await pool.query("ALTER TABLE `shops` ADD COLUMN `ownerPassword` VARCHAR(255) DEFAULT 'admin123' AFTER `ownerPhone`");
      console.log('Added ownerPassword to shops');
    }

    // Update all rows in shops to show superAdminEmail and superAdminPassword
    await pool.query("UPDATE `shops` SET `superAdminEmail` = 'Mainyet123@gmail.com', `superAdminPassword` = 'super123456.'");
    await pool.query("UPDATE `shops` SET `ownerPassword` = 'admin123' WHERE `ownerPassword` IS NULL OR `ownerPassword` = ''");
    console.log('Updated shops table with superAdminEmail and superAdminPassword');

    // 2. Hash new password
    const hashedPassword = await bcrypt.hash('super123456.', 10);

    // Check if Mainyet123@gmail.com exists in users
    const [existing] = await pool.query("SELECT * FROM users WHERE email = 'Mainyet123@gmail.com' OR username = 'Mainyet123@gmail.com'");
    if (existing.length > 0) {
      await pool.query("UPDATE users SET username = 'Mainyet123@gmail.com', email = 'Mainyet123@gmail.com', password = ?, role = 'super_admin' WHERE id = ?", [hashedPassword, existing[0].id]);
      console.log('Updated existing Mainyet123@gmail.com');
    } else {
      // Update existing super_admin user or insert
      const [superAdmins] = await pool.query("SELECT * FROM users WHERE role = 'super_admin'");
      if (superAdmins.length > 0) {
        await pool.query("UPDATE users SET username = 'Mainyet123@gmail.com', email = 'Mainyet123@gmail.com', fullName = 'System Super Admin', password = ? WHERE id = ?", [hashedPassword, superAdmins[0].id]);
        console.log('Updated super_admin user (id: ' + superAdmins[0].id + ') to Mainyet123@gmail.com');
      } else {
        await pool.query("INSERT INTO users (username, email, fullName, role, password, status) VALUES ('Mainyet123@gmail.com', 'Mainyet123@gmail.com', 'System Super Admin', 'super_admin', ?, 'active')", [hashedPassword]);
        console.log('Inserted new super_admin Mainyet123@gmail.com');
      }
    }

    // Verify
    const [updatedShops] = await pool.query('SELECT id, name, ownerEmail, superAdminEmail, superAdminPassword FROM shops');
    console.log('Shops now:', updatedShops);

    const [updatedUsers] = await pool.query("SELECT id, username, email, role FROM users WHERE role = 'super_admin'");
    console.log('Super Admins now:', updatedUsers);

    console.log('Done successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating superadmin:', error);
    process.exit(1);
  }
}

run();
