import pool from '../config/mysql.js';

export async function initPaymentLedgerTables() {
  console.log('🚀 Initializing dynamic MySQL tables for Customer & Vendor Payment Ledgers across all branches...');

  const branches = [
    { shopId: 1, prefix: 'peshawar_branch', name: 'Peshawar Branch' },
    { shopId: 2, prefix: 'mardan_branch', name: 'Mardan Branch' },
    { shopId: 3, prefix: 'attock_branch', name: 'Attock Branch' },
    { shopId: 4, prefix: 'peshawar_branch', name: 'Peshawar Karkhano' }
  ];

  try {
    const [shops] = await pool.query('SELECT id, name FROM shops');
    for (const s of shops) {
      const sName = (s.name || '').toLowerCase();
      let pfx = 'peshawar_branch';
      if (sName.includes('mardan')) pfx = 'mardan_branch';
      else if (sName.includes('attock')) pfx = 'attock_branch';
      else if (sName.includes('peshawar') || sName.includes('peshawer')) pfx = 'peshawar_branch';
      else pfx = `shop_${s.id}_branch`;

      if (!branches.some(b => b.shopId === s.id)) {
        branches.push({ shopId: s.id, prefix: pfx, name: s.name });
      }
    }
  } catch (err) {
    console.warn('Could not query shops table, using default branch list:', err.message);
  }

  // For each branch, create isolated table inside that branch: branch_prefix__customer_payment_ledger & branch_prefix__vendor_payment_ledger
  const distinctPrefixes = [...new Set(branches.map(b => b.prefix))];

  for (const pfx of distinctPrefixes) {
    const custTable = `${pfx}__customer_payment_ledger`;
    const vndTable = `${pfx}__vendor_payment_ledger`;

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`${custTable}\` (
        \`id\` VARCHAR(255) PRIMARY KEY,
        \`shopId\` INT NOT NULL DEFAULT 1,
        \`saleId\` VARCHAR(255) NULL,
        \`invoiceNumber\` VARCHAR(100) NULL,
        \`customerName\` VARCHAR(255) NULL,
        \`customerPhone\` VARCHAR(50) NULL,
        \`category\` VARCHAR(100) DEFAULT 'Eggs',
        \`itemsDescription\` TEXT NULL,
        \`petisBought\` DECIMAL(10,2) DEFAULT 0.00,
        \`eggsBought\` INT DEFAULT 0,
        \`totalAmount\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        \`cashPaid\` DECIMAL(12,2) DEFAULT 0.00,
        \`bankPaid\` DECIMAL(12,2) DEFAULT 0.00,
        \`dueAmount\` DECIMAL(12,2) DEFAULT 0.00,
        \`paymentMethod\` VARCHAR(50) DEFAULT 'CASH',
        \`status\` VARCHAR(50) DEFAULT 'PAID',
        \`date\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY \`idx_cust_ledger_shopId\` (\`shopId\`),
        KEY \`idx_cust_ledger_date\` (\`date\`),
        KEY \`idx_cust_ledger_invoice\` (\`invoiceNumber\`),
        KEY \`idx_cust_ledger_customer\` (\`customerName\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`${vndTable}\` (
        \`id\` VARCHAR(255) PRIMARY KEY,
        \`shopId\` INT NOT NULL DEFAULT 1,
        \`purchaseId\` VARCHAR(255) NULL,
        \`supplierName\` VARCHAR(255) NULL,
        \`supplierPhone\` VARCHAR(50) NULL,
        \`supplierLocation\` VARCHAR(255) NULL,
        \`productName\` VARCHAR(255) NULL,
        \`category\` VARCHAR(100) DEFAULT 'Eggs',
        \`petisPurchased\` DECIMAL(10,2) DEFAULT 0.00,
        \`eggQuantity\` INT DEFAULT 0,
        \`unitType\` VARCHAR(50) DEFAULT 'peti',
        \`buyCost\` DECIMAL(12,2) DEFAULT 0.00,
        \`totalCost\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        \`amountPaid\` DECIMAL(12,2) DEFAULT 0.00,
        \`cashPaid\` DECIMAL(12,2) DEFAULT 0.00,
        \`bankPaid\` DECIMAL(12,2) DEFAULT 0.00,
        \`dueAmount\` DECIMAL(12,2) DEFAULT 0.00,
        \`paymentMethod\` VARCHAR(50) DEFAULT 'Cash',
        \`status\` VARCHAR(50) DEFAULT 'PAID',
        \`date\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY \`idx_vnd_ledger_shopId\` (\`shopId\`),
        KEY \`idx_vnd_ledger_date\` (\`date\`),
        KEY \`idx_vnd_ledger_supplier\` (\`supplierName\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log(`✅ Verified MySQL branch tables inside branch: \`${custTable}\` & \`${vndTable}\``);

    // Also auto-ensure columns on branch sales tables
    const salesTable = `${pfx}__sales`;
    try {
      const [salesCols] = await pool.query(`DESCRIBE \`${salesTable}\``).catch(() => [[]]);
      const sColsSet = new Set(salesCols.map(c => c.Field));
      if (!sColsSet.has('items')) {
        await pool.query(`ALTER TABLE \`${salesTable}\` ADD COLUMN \`items\` LONGTEXT NULL`).catch(() => {});
      }
      if (!sColsSet.has('itemsDescription')) {
        await pool.query(`ALTER TABLE \`${salesTable}\` ADD COLUMN \`itemsDescription\` TEXT NULL`).catch(() => {});
      }
      if (!sColsSet.has('petisBought')) {
        await pool.query(`ALTER TABLE \`${salesTable}\` ADD COLUMN \`petisBought\` DECIMAL(10,2) DEFAULT 0.00`).catch(() => {});
      }
      if (!sColsSet.has('eggsBought')) {
        await pool.query(`ALTER TABLE \`${salesTable}\` ADD COLUMN \`eggsBought\` INT DEFAULT 0`).catch(() => {});
      }
      if (!sColsSet.has('category')) {
        await pool.query(`ALTER TABLE \`${salesTable}\` ADD COLUMN \`category\` VARCHAR(100) DEFAULT 'Eggs'`).catch(() => {});
      }
    } catch (_) {}
  }

  // Ensure root tables also exist for dynamic fallbacks
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`customer_payment_ledger\` (
        \`id\` VARCHAR(255) PRIMARY KEY,
        \`shopId\` INT NOT NULL DEFAULT 1,
        \`saleId\` VARCHAR(255) NULL,
        \`invoiceNumber\` VARCHAR(100) NULL,
        \`customerName\` VARCHAR(255) NULL,
        \`customerPhone\` VARCHAR(50) NULL,
        \`category\` VARCHAR(100) DEFAULT 'Eggs',
        \`itemsDescription\` TEXT NULL,
        \`petisBought\` DECIMAL(10,2) DEFAULT 0.00,
        \`eggsBought\` INT DEFAULT 0,
        \`totalAmount\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        \`cashPaid\` DECIMAL(12,2) DEFAULT 0.00,
        \`bankPaid\` DECIMAL(12,2) DEFAULT 0.00,
        \`dueAmount\` DECIMAL(12,2) DEFAULT 0.00,
        \`paymentMethod\` VARCHAR(50) DEFAULT 'CASH',
        \`status\` VARCHAR(50) DEFAULT 'PAID',
        \`date\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY \`idx_cpl_root_shop\` (\`shopId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`vendor_payment_ledger\` (
        \`id\` VARCHAR(255) PRIMARY KEY,
        \`shopId\` INT NOT NULL DEFAULT 1,
        \`purchaseId\` VARCHAR(255) NULL,
        \`supplierName\` VARCHAR(255) NULL,
        \`supplierPhone\` VARCHAR(50) NULL,
        \`supplierLocation\` VARCHAR(255) NULL,
        \`productName\` VARCHAR(255) NULL,
        \`category\` VARCHAR(100) DEFAULT 'Eggs',
        \`petisPurchased\` DECIMAL(10,2) DEFAULT 0.00,
        \`eggQuantity\` INT DEFAULT 0,
        \`unitType\` VARCHAR(50) DEFAULT 'peti',
        \`buyCost\` DECIMAL(12,2) DEFAULT 0.00,
        \`totalCost\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        \`amountPaid\` DECIMAL(12,2) DEFAULT 0.00,
        \`cashPaid\` DECIMAL(12,2) DEFAULT 0.00,
        \`bankPaid\` DECIMAL(12,2) DEFAULT 0.00,
        \`dueAmount\` DECIMAL(12,2) DEFAULT 0.00,
        \`paymentMethod\` VARCHAR(50) DEFAULT 'Cash',
        \`status\` VARCHAR(50) DEFAULT 'PAID',
        \`date\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY \`idx_vpl_root_shop\` (\`shopId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (_) {}

  // 4. Populate / Sync Data from Sales and Purchases into Branch Tables
  try {
    for (const b of branches) {
      const pfx = b.prefix;
      const sId = b.shopId;
      const salesTable = `${pfx}__sales`;
      const purchasesTable = `${pfx}__purchases`;
      const custTable = `${pfx}__customer_payment_ledger`;
      const vndTable = `${pfx}__vendor_payment_ledger`;

      // Sync sales into custTable
      const [salesRows] = await pool.query(`SELECT * FROM \`${salesTable}\` WHERE shopId = ?`, [sId]).catch(() => [[]]);
      if (salesRows && salesRows.length > 0) {
        for (const s of salesRows) {
          const sid = s.id || s._id;
          const total = Number(s.totalAmount || 0);
          const cash = Number(s.cashPaid || 0);
          const bank = Number(s.bankPaid || 0);
          const due = Number(s.dueAmount || 0);

          let saleItems = [];
          if (Array.isArray(s.items)) saleItems = s.items;
          else if (typeof s.items === 'string' && s.items.trim()) {
            try { saleItems = JSON.parse(s.items); if (typeof saleItems === 'string') saleItems = JSON.parse(saleItems); } catch {}
          }
          if (!Array.isArray(saleItems)) saleItems = [];

          let petis = Number(s.petisBought || 0);
          let eggs = Number(s.eggsBought || 0);
          let descParts = [];

          if (saleItems.length > 0) {
            saleItems.forEach(it => {
              const qty = Number(it.quantity) || 1;
              const u = (it.unitLabel || it.unit || 'peti').toLowerCase();
              if (u.includes('peti')) { petis += qty; eggs += qty * 360; }
              else if (u.includes('tray')) { petis += qty / 12; eggs += qty * 30; }
              else { eggs += qty; petis += qty / 360; }
              descParts.push(`${it.rawProductName || it.name || 'Eggs'} (${qty} ${u})`);
            });
          } else if (petis === 0 && eggs === 0 && total > 0) {
            petis = Number((total / 1050).toFixed(2)) || 1;
            eggs = Math.round(petis * 360);
            descParts.push(`Eggs Stock (${petis} Petis • ${eggs} Eggs)`);
          }

          const itemsDescription = descParts.join(', ') || s.itemsDescription || 'Eggs Stock';

          await pool.query(`
            INSERT INTO \`${custTable}\`
            (id, shopId, saleId, invoiceNumber, customerName, customerPhone, category, itemsDescription, petisBought, eggsBought, totalAmount, cashPaid, bankPaid, dueAmount, paymentMethod, status, date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              customerName = VALUES(customerName),
              customerPhone = VALUES(customerPhone),
              itemsDescription = VALUES(itemsDescription),
              petisBought = VALUES(petisBought),
              eggsBought = VALUES(eggsBought),
              totalAmount = VALUES(totalAmount),
              cashPaid = VALUES(cashPaid),
              bankPaid = VALUES(bankPaid),
              dueAmount = VALUES(dueAmount),
              status = VALUES(status)
          `, [
            `cpl-${sid}`,
            sId,
            String(sid),
            s.invoiceNumber || `INV-${sid}`,
            s.customerName || 'Walk-in Customer',
            s.customerPhone || '',
            s.category || (saleItems[0]?.category) || 'Eggs',
            itemsDescription,
            Number(Number(petis).toFixed(2)),
            Math.round(eggs),
            total,
            cash,
            bank,
            due,
            s.paymentMethod || 'CASH',
            due === 0 ? 'PAID' : (cash > 0 || bank > 0 ? 'PARTIAL' : 'CREDIT'),
            s.saleDate || s.createdAt || new Date()
          ]).catch(() => {});
        }
      }

      // Sync purchases into vndTable
      const [purchRows] = await pool.query(`SELECT * FROM \`${purchasesTable}\` WHERE shopId = ?`, [sId]).catch(() => [[]]);
      if (purchRows && purchRows.length > 0) {
        for (const p of purchRows) {
          const pid = p.id || p._id;
          const total = Number(p.totalCost || 0);
          const paid = Number(p.amountPaid || 0);
          const cash = Number(p.cashPaid || 0);
          const bank = Number(p.bankPaid || 0);
          const due = Number(p.dueAmount || 0);

          let petis = Number(p.petisPurchased || p.petiQuantity || 0);
          let eggs = Number(p.eggQuantity || 0);
          const qText = String(p.quantityText || p.notes || p.productName || '');
          if (qText) {
            const pMatch = qText.match(/(\d+(?:\.\d+)?)\s*(?:peti|petis|box|boxes|p\b)/i);
            const eMatch = qText.match(/([\d,]+(?:\.\d+)?)\s*(?:egg|eggs|e\b|stock)/i);
            if (pMatch && !petis) petis = parseFloat(pMatch[1]);
            if (eMatch && !eggs) eggs = parseFloat(eMatch[1].replace(/,/g, ''));
          }
          if (petis > 0 && eggs === 0) eggs = Math.round(petis * 360);
          if (eggs > 0 && petis === 0) petis = Number((eggs / 360).toFixed(2));

          await pool.query(`
            INSERT INTO \`${vndTable}\`
            (id, shopId, purchaseId, supplierName, supplierPhone, supplierLocation, productName, category, petisPurchased, eggQuantity, unitType, buyCost, totalCost, amountPaid, cashPaid, bankPaid, dueAmount, paymentMethod, status, date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              supplierName = VALUES(supplierName),
              petisPurchased = VALUES(petisPurchased),
              eggQuantity = VALUES(eggQuantity),
              totalCost = VALUES(totalCost),
              amountPaid = VALUES(amountPaid),
              dueAmount = VALUES(dueAmount)
          `, [
            `vpl-${pid}`,
            sId,
            String(pid),
            p.supplierName || 'Farm Vendor',
            p.supplierPhone || '',
            p.supplierLocation || '',
            p.productName || 'Eggs Stock',
            p.category || 'Eggs',
            petis,
            eggs,
            p.unitType || 'peti',
            Number(p.buyCost || 0),
            total,
            paid,
            cash,
            bank,
            due,
            p.paymentMethod || 'Cash',
            due === 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'CREDIT'),
            p.purchaseDate || p.createdAt || new Date()
          ]).catch(() => {});
        }
      }
    }
  } catch (syncErr) {
    console.warn('Initial ledger table data sync notice:', syncErr.message);
  }

  console.log('✨ All MySQL Customer & Vendor Payment Ledger tables created and ready for all branches!');
}

export default initPaymentLedgerTables;
