import pool from './config/mysql.js';

async function syncAllSidebarTables() {
  try {
    console.log('🚀 Setting up dedicated relational tables for all sidebar pages in MySQL...');

    // 1. Vendors / Suppliers Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shopId INT NOT NULL DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(100) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        location VARCHAR(255) DEFAULT '',
        farmLocation VARCHAR(255) DEFAULT '',
        notes TEXT,
        status VARCHAR(50) DEFAULT 'active',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_vendor_shop (shopId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ 1. Created/Verified table: vendors');

    // 2. Purchases & Restocks Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shopId INT NOT NULL DEFAULT 1,
        itemId INT DEFAULT NULL,
        vendorId INT DEFAULT NULL,
        productName VARCHAR(255) NOT NULL,
        supplierName VARCHAR(255) DEFAULT '',
        supplierPhone VARCHAR(100) DEFAULT '',
        supplierLocation VARCHAR(255) DEFAULT '',
        petiQuantity DECIMAL(10,2) DEFAULT 0,
        trayQuantity DECIMAL(10,2) DEFAULT 0,
        eggQuantity DECIMAL(10,2) DEFAULT 0,
        unitType VARCHAR(50) DEFAULT 'peti',
        buyCost DECIMAL(12,2) DEFAULT 0,
        totalCost DECIMAL(12,2) DEFAULT 0,
        paymentType VARCHAR(50) DEFAULT 'Cash',
        amountPaid DECIMAL(12,2) DEFAULT 0,
        dueAmount DECIMAL(12,2) DEFAULT 0,
        paymentReceipt TEXT,
        paymentProof TEXT,
        notes TEXT,
        purchaseDate DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_purchase_shop (shopId),
        KEY idx_purchase_item (itemId),
        KEY idx_purchase_vendor (vendorId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ 2. Created/Verified table: purchases');

    // 3. Customer Credits Table (Customer Receivables & Due Statements)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_credits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shopId INT NOT NULL DEFAULT 1,
        customerId INT DEFAULT NULL,
        saleId INT DEFAULT NULL,
        customerName VARCHAR(255) NOT NULL,
        customerPhone VARCHAR(100) DEFAULT '',
        customerEmail VARCHAR(255) DEFAULT '',
        totalAmount DECIMAL(12,2) DEFAULT 0,
        paidAmount DECIMAL(12,2) DEFAULT 0,
        dueAmount DECIMAL(12,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'UNPAID',
        notes TEXT,
        paymentMethod VARCHAR(50) DEFAULT 'CASH',
        transactionId VARCHAR(255) DEFAULT '',
        paymentProof TEXT,
        lastPaymentDate DATETIME DEFAULT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_cc_shop (shopId),
        KEY idx_cc_cust (customerId),
        KEY idx_cc_sale (saleId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ 3. Created/Verified table: customer_credits');

    // 4. Purchase Credits Table (Supplier Purchase Debt Ledger & Settlements)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_credits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shopId INT NOT NULL DEFAULT 1,
        itemId INT DEFAULT NULL,
        purchaseId INT DEFAULT NULL,
        vendorId INT DEFAULT NULL,
        productName VARCHAR(255) NOT NULL,
        supplierName VARCHAR(255) NOT NULL,
        supplierPhone VARCHAR(100) DEFAULT '',
        supplierLocation VARCHAR(255) DEFAULT '',
        quantityText VARCHAR(100) DEFAULT '',
        totalCost DECIMAL(12,2) DEFAULT 0,
        paidToDate DECIMAL(12,2) DEFAULT 0,
        pendingDue DECIMAL(12,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'PARTIAL',
        paymentMethod VARCHAR(50) DEFAULT 'Cash',
        paymentReceipt TEXT,
        notes TEXT,
        lastSettlementDate DATETIME DEFAULT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_pc_shop (shopId),
        KEY idx_pc_item (itemId),
        KEY idx_pc_vendor (vendorId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ 4. Created/Verified table: purchase_credits');

    // 5. Fuel & Vehicle Expenses Tables for all branches
    const fuelBranchPrefixes = ['peshawar_branch', 'mardan_branch', 'attock_branch'];
    for (const pfx of fuelBranchPrefixes) {
      const fuelTable = `${pfx}__fuel_expenses`;
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`${fuelTable}\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`shopId\` INT NOT NULL DEFAULT 1,
          \`vehicleNo\` VARCHAR(100) NOT NULL,
          \`vehicleName\` VARCHAR(150) NULL,
          \`driverName\` VARCHAR(150) NULL,
          \`driverPhone\` VARCHAR(50) NULL,
          \`purpose\` VARCHAR(255) DEFAULT 'Stock Purchase Transport',
          \`fuelType\` VARCHAR(50) DEFAULT 'Diesel',
          \`liters\` DECIMAL(10,2) DEFAULT 0.00,
          \`ratePerLiter\` DECIMAL(10,2) DEFAULT 0.00,
          \`totalAmount\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          \`paymentMethod\` VARCHAR(50) DEFAULT 'CASH',
          \`paidAmount\` DECIMAL(12,2) DEFAULT 0.00,
          \`dueAmount\` DECIMAL(12,2) DEFAULT 0.00,
          \`petrolPump\` VARCHAR(255) NULL,
          \`odometerReading\` VARCHAR(50) NULL,
          \`expenseDate\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`notes\` TEXT NULL,
          \`createdBy\` VARCHAR(255) DEFAULT 'Shop Admin',
          \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY \`idx_fuel_shopId\` (\`shopId\`),
          KEY \`idx_fuel_date\` (\`expenseDate\`),
          KEY \`idx_fuel_vehicle\` (\`vehicleNo\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log(`✅ 5. Created/Verified table: ${fuelTable}`);
    }

    // Synchronize data from existing items into vendors, purchases, and purchase_credits
    const [items] = await pool.query('SELECT * FROM items');
    for (const it of items) {
      if (it.supplierName && it.supplierName.trim()) {
        const vName = it.supplierName.trim();
        const [existingVendors] = await pool.query('SELECT id FROM vendors WHERE shopId = ? AND name = ?', [it.shopId || 1, vName]);
        let vendorId = existingVendors[0]?.id;
        if (!vendorId) {
          const [insV] = await pool.query(
            'INSERT INTO vendors (shopId, name, phone, location, status) VALUES (?, ?, ?, ?, ?)',
            [it.shopId || 1, vName, it.supplierPhone || '', it.supplierLocation || '', 'active']
          );
          vendorId = insV.insertId;
        }

        const [existingPurchases] = await pool.query('SELECT id FROM purchases WHERE itemId = ?', [it.id]);
        let purchaseId = existingPurchases[0]?.id;
        if (!purchaseId) {
          const petis = Number(it.petiQuantity || 0);
          const buyCost = Number(it.buyCost || it.costPrice || 0);
          const totalCost = Number(it.totalPurchaseCost) > 0 ? Number(it.totalPurchaseCost) : (petis > 0 ? petis * buyCost : Number(it.costPrice || it.price || 0));
          const amtPaid = Number(it.amountPaidToSupplier || it.cashPaidToSupplier || 0);
          const dueAmt = Number(it.dueAmountToSupplier) >= 0 ? Number(it.dueAmountToSupplier) : Math.max(0, totalCost - amtPaid);

          const [insP] = await pool.query(
            `INSERT INTO purchases (shopId, itemId, vendorId, productName, supplierName, supplierPhone, supplierLocation, petiQuantity, trayQuantity, eggQuantity, unitType, buyCost, totalCost, paymentType, amountPaid, dueAmount, paymentReceipt, notes, purchaseDate, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              it.shopId || 1,
              it.id,
              vendorId,
              it.name,
              vName,
              it.supplierPhone || '',
              it.supplierLocation || '',
              it.petiQuantity || 0,
              it.trayQuantity || 0,
              it.eggQuantity || 0,
              it.unitType || 'peti',
              buyCost,
              totalCost,
              it.paymentType || (dueAmt > 0 ? 'Credit' : 'Cash'),
              amtPaid,
              dueAmt,
              it.paymentReceipt || '',
              it.notes || '',
              it.createdAt || new Date(),
              it.createdAt || new Date()
            ]
          );
          purchaseId = insP.insertId;
        }

        const dueAmt = Number(it.dueAmountToSupplier || 0);
        const [existingPC] = await pool.query('SELECT id FROM purchase_credits WHERE itemId = ?', [it.id]);
        if (!existingPC[0]) {
          const petis = Number(it.petiQuantity || 0);
          const buyCost = Number(it.buyCost || it.costPrice || 0);
          const totalCost = Number(it.totalPurchaseCost) > 0 ? Number(it.totalPurchaseCost) : (petis > 0 ? petis * buyCost : Number(it.costPrice || 0));
          const amtPaid = Number(it.amountPaidToSupplier || it.cashPaidToSupplier || 0);
          const status = dueAmt <= 0 ? 'PAID' : (amtPaid > 0 ? 'PARTIAL' : 'UNPAID');

          await pool.query(
            `INSERT INTO purchase_credits (shopId, itemId, purchaseId, vendorId, productName, supplierName, supplierPhone, supplierLocation, quantityText, totalCost, paidToDate, pendingDue, status, paymentMethod, paymentReceipt, notes, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              it.shopId || 1,
              it.id,
              purchaseId,
              vendorId,
              it.name,
              vName,
              it.supplierPhone || '',
              it.supplierLocation || '',
              `${petis} Petis`,
              totalCost,
              amtPaid,
              dueAmt,
              status,
              it.paymentType || 'Cash',
              it.paymentReceipt || '',
              it.notes || '',
              it.createdAt || new Date()
            ]
          );
        }
      }
    }

    // Populate customer_credits from sales with credit / dueAmount
    const [creditSales] = await pool.query('SELECT * FROM sales WHERE dueAmount > 0 OR isCredit = 1');
    for (const s of creditSales) {
      const [existingCC] = await pool.query('SELECT id FROM customer_credits WHERE saleId = ?', [s.id]);
      if (!existingCC[0]) {
        const total = Number(s.totalAmount || 0);
        const paid = Number(s.cashPaid || 0) + Number(s.bankPaid || 0);
        const due = Number(s.dueAmount || 0);
        const status = due <= 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID');

        await pool.query(
          `INSERT INTO customer_credits (shopId, customerId, saleId, customerName, customerPhone, customerEmail, totalAmount, paidAmount, dueAmount, status, notes, paymentMethod, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.shopId || 1,
            s.customerId || null,
            s.id,
            s.customerName || 'Credit Customer',
            s.customerPhone || '',
            s.customerEmail || '',
            total,
            paid,
            due,
            status,
            s.invoiceNumber || '',
            s.paymentMethod || 'CASH',
            s.saleDate || s.createdAt || new Date()
          ]
        );
      }
    }

    const [allTables] = await pool.query('SHOW TABLES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 ALL TABLES IN DATABASE:');
    allTables.forEach((t, i) => console.log(` ${i + 1}. ${Object.values(t)[0]}`));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during table sync:', err);
    process.exit(1);
  }
}

syncAllSidebarTables();
