import Shop from './models/Shop.js';
import User from './models/User.js';
import Settings from './models/Settings.js';
import pool from './config/mysql.js';

export const seedDatabase = async () => {
  try {
    // 1. Ensure at least one default Shop exists to satisfy Foreign Key constraints
    const shopCount = await Shop.countDocuments();
    if (shopCount === 0) {
      console.log('🌱 Shops table is empty. Seeding default shop (id: 1)...');
      
      await pool.query(`
        INSERT INTO \`shops\` (\`id\`, \`name\`, \`address\`, \`status\`, \`contactNumber\`, \`ownerFullName\`, \`ownerEmail\`)
        VALUES (1, 'Peshawar Branch', 'Karkhano Market, Peshawar', 'active', '+923295649784', 'Peshawar Shop Admin', 'peshawershopadmin@gmail.com')
        ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`)
      `);

      // Ensure default settings for shop 1
      const settingExists = await Settings.findOne({ shopId: 1 });
      if (!settingExists) {
        await Settings.create({
          shopId: 1,
          shopName: 'Peshawar Branch',
          address: 'Karkhano Market, Peshawar',
          phone: '+923295649784',
          currency: 'Rs.',
          ownerPassword: 'admin123',
          ownerFullName: 'Peshawar Shop Admin',
          ownerEmail: 'peshawershopadmin@gmail.com'
        });
      }

      console.log('✅ Default Shop (id: 1) created successfully.');
    }

    // 2. Ensure Super Admin account exists
    const superAdmin = await User.findOne({
      $or: [
        { role: 'super_admin' },
        { email: 'Mainyet123@gmail.com' },
        { username: 'Mainyet123@gmail.com' }
      ]
    });

    if (!superAdmin) {
      console.log('🌱 Super Admin missing. Creating default Super Admin...');
      await User.create({
        username: 'Mainyet123@gmail.com',
        email: 'Mainyet123@gmail.com',
        fullName: 'System Super Admin',
        role: 'super_admin',
        password: 'super123456.',
        status: 'active'
      });
      console.log('✅ Default Super Admin created: Mainyet123@gmail.com / super123456.');
    }

    // 3. Ensure Default Branch Admin exists
    const shopAdmin = await User.findOne({
      $or: [
        { email: 'admin@pos.com' },
        { username: 'admin@pos.com' },
        { role: 'shop_admin' }
      ]
    });

    if (!shopAdmin) {
      await User.create({
        username: 'admin@pos.com',
        email: 'admin@pos.com',
        fullName: 'Peshawar Admin',
        role: 'shop_admin',
        shopId: 1,
        password: 'admin123',
        status: 'active'
      });
      console.log('✅ Default Shop Admin created: admin@pos.com / admin123');
    }

    // 4. Ensure Physical Base Tables & Triggers for all 3 branches
    try {
      const { ensureShopApprovalColumns } = await import('./routes/shops.js');
      await ensureShopApprovalColumns();
      const bModule = await import('./createBranchTables.js');
      await bModule.createAllBranchTables();
      const ccModule = await import('./create_customer_credits_tables.js');
      await ccModule.initCustomerCreditTables();
      const pcModule = await import('./create_purchase_credits_tables.js');
      await pcModule.initPurchaseCreditTables();
      const prModule = await import('./create_profit_reports_tables.js');
      await prModule.initProfitReportTables();
      const fuelModule = await import('./create_fuel_expenses_tables.js');
      await fuelModule.initFuelAndBankSchema();
    } catch (tblErr) {
      console.error('Branch table initialization warning:', tblErr.message);
    }

    return true;
  } catch (err) {
    console.error('❌ Database Seeder Error:', err.message);
    return false;
  }
};

// If run directly via CLI (e.g. `node seed.js`)
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase().then(() => {
    console.log('Seeder process complete.');
    process.exit(0);
  });
}

export default seedDatabase;
