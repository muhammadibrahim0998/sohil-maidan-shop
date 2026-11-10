import pool from '../config/mysql.js';

async function run() {
  console.log('Restoring Super Admin into shops table...');

  // 1. Insert or update Super Admin (Head Office) as id 4 in shops table
  await pool.query(`
    INSERT INTO \`shops\` (
      id, name, address, status, contactNumber, 
      ownerFullName, ownerEmail, ownerPhone, ownerPassword, 
      superAdminEmail, superAdminPassword, isEditApproved, isDeleteApproved, approvalStatus
    ) VALUES (
      4, 'SUPER ADMIN (HEAD OFFICE)', 'MAIN HEAD OFFICE, PAKISTAN', 'active', '+923098216202',
      'System Super Admin', 'Mainyet123@gmail.com', '+923098216202', 'super123456',
      'Mainyet123@gmail.com', 'super123456', 1, 1, 'APPROVED'
    ) ON DUPLICATE KEY UPDATE 
      name = VALUES(name),
      address = VALUES(address),
      status = 'active',
      contactNumber = VALUES(contactNumber),
      ownerFullName = VALUES(ownerFullName),
      ownerEmail = VALUES(ownerEmail),
      ownerPhone = VALUES(ownerPhone),
      ownerPassword = VALUES(ownerPassword),
      superAdminEmail = VALUES(superAdminEmail),
      superAdminPassword = VALUES(superAdminPassword),
      isEditApproved = 1,
      isDeleteApproved = 1,
      approvalStatus = 'APPROVED'
  `);

  // 2. Ensure settings for shop 4
  await pool.query(`
    INSERT INTO \`settings\` (
      shopId, shopName, address, phone, email, currency, 
      ownerPassword, ownerFullName, ownerEmail, ownerPhone
    ) VALUES (
      4, 'SUPER ADMIN (HEAD OFFICE)', 'MAIN HEAD OFFICE, PAKISTAN', '+923098216202', 'Mainyet123@gmail.com', 'Rs.',
      'super123456', 'System Super Admin', 'Mainyet123@gmail.com', '+923098216202'
    ) ON DUPLICATE KEY UPDATE 
      shopName = VALUES(shopName),
      address = VALUES(address),
      phone = VALUES(phone),
      email = VALUES(email),
      ownerPassword = VALUES(ownerPassword),
      ownerFullName = VALUES(ownerFullName),
      ownerEmail = VALUES(ownerEmail),
      ownerPhone = VALUES(ownerPhone)
  `);

  // 3. Verify shops table
  const [shops] = await pool.query('SELECT id, name, status, contactNumber, ownerFullName, ownerEmail, ownerPassword, superAdminEmail, superAdminPassword FROM `shops` ORDER BY id ASC');
  console.log('\n--- 📋 SHOPS TABLE NOW ---');
  console.log(shops);

  console.log('\n✅ Super Admin is successfully restored to database and dashboard!');
  process.exit(0);
}

run();
