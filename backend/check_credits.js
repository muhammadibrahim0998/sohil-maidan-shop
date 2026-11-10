import pool from './config/mysql.js';

async function checkCredits() {
  const branches = [
    { shopId: 1, prefix: 'peshawar_branch' },
    { shopId: 2, prefix: 'mardan_branch' },
    { shopId: 3, prefix: 'attock_branch' }
  ];

  for (const b of branches) {
    try {
      const [items] = await pool.query(`SELECT id, name, supplierName, totalPurchaseCost, amountPaidToSupplier, dueAmountToSupplier FROM \`${b.prefix}__items\``);
      const [pcs] = await pool.query(`SELECT * FROM \`${b.prefix}__purchase_credits\``);
      console.log(`=== ${b.prefix} (Shop ID: ${b.shopId}) ===`);
      console.log('Items count:', items.length);
      console.log('Items:', items);
      console.log('Purchase Credits count:', pcs.length);
      console.log('Purchase Credits:', pcs);
    } catch (err) {
      console.error(`Error checking ${b.prefix}:`, err.message);
    }
  }

  process.exit(0);
}

checkCredits();
