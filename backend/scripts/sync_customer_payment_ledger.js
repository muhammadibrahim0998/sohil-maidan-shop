/**
 * sync_customer_payment_ledger.js
 * 
 * د پخوانیو Sales records لپاره د customer_payment_ledger table populate کوي.
 * Backfill script - یوازې یو ځل چلوئ.
 * 
 * Run: node scripts/sync_customer_payment_ledger.js
 */

import pool from '../config/mysql.js';
import { BRANCH_TABLE_PREFIXES, ALL_BRANCH_PREFIXES } from '../models/dbHelper.js';

const BRANCHES = [
  { prefix: 'peshawar_branch', shopIds: [1, 4] },
  { prefix: 'mardan_branch', shopIds: [2] },
  { prefix: 'attock_branch', shopIds: [3] }
];

function parseItems(items) {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string' && items) {
    try { return JSON.parse(items); } catch { return []; }
  }
  return [];
}

function calcPetisAndEggs(saleItems) {
  let totalPetis = 0;
  let totalEggs = 0;
  const descParts = [];

  for (const it of saleItems) {
    const qty = Number(it.quantity) || 1;
    const uType = (it.unitLabel || it.unit || it.unitType || 'peti').toLowerCase();
    const nm = it.rawProductName || it.name || 'Eggs';
    let petis = 0;
    let eggs = 0;

    if (uType.includes('peti')) {
      petis = qty;
      eggs = qty * 360;
    } else if (uType.includes('tray')) {
      petis = qty / 12;
      eggs = qty * 30;
    } else {
      eggs = Number(it.totalEggs) > 0 ? Number(it.totalEggs) : qty;
      petis = eggs / 360;
    }

    if (Number(it.petiQuantity) > 0) petis = Number(it.petiQuantity);
    if (Number(it.totalEggs) > 0) eggs = Number(it.totalEggs);

    totalPetis += petis;
    totalEggs += eggs;
    descParts.push(`${nm} (${qty} ${uType})`);
  }

  return {
    petisBought: Number(totalPetis.toFixed(2)),
    eggsBought: Math.round(totalEggs),
    itemsDescription: descParts.join(', ') || 'Eggs Stock'
  };
}

async function syncBranch(prefix, shopIds) {
  const salesTable = `\`${prefix}__sales\``;
  const ledgerTable = `\`${prefix}__customer_payment_ledger\``;

  console.log(`\n📦 Processing ${prefix}...`);

  // Get all existing ledger saleIds to avoid duplicates
  let existingSaleIds = new Set();
  try {
    const [existing] = await pool.query(`SELECT saleId FROM ${ledgerTable}`);
    existing.forEach(r => existingSaleIds.add(String(r.saleId)));
    console.log(`   ✅ Found ${existingSaleIds.size} existing ledger records`);
  } catch (e) {
    console.log(`   ⚠️ Could not read ledger table: ${e.message}`);
    return;
  }

  // Get all sales not yet in ledger
  let sales = [];
  try {
    const [rows] = await pool.query(`SELECT * FROM ${salesTable} ORDER BY id ASC`);
    sales = rows;
    console.log(`   📋 Found ${sales.length} total sales`);
  } catch (e) {
    console.log(`   ❌ Could not read sales table: ${e.message}`);
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const sale of sales) {
    const saleId = String(sale.id);
    // Skip records with invalid/empty IDs
    if (!sale.id || saleId === '' || saleId === '0') {
      skipped++;
      continue;
    }
    if (existingSaleIds.has(saleId)) {
      skipped++;
      continue;
    }

    const saleItems = parseItems(sale.items);
    const { petisBought, eggsBought, itemsDescription } = calcPetisAndEggs(saleItems);

    const cashPaid = Number(sale.cashPaid) || 0;
    const bankPaid = Number(sale.bankPaid) || 0;
    const dueAmount = Number(sale.dueAmount) || 0;
    const totalAmount = Number(sale.totalAmount) || 0;
    const status = dueAmount <= 0 ? 'PAID' : (cashPaid > 0 || bankPaid > 0 ? 'PARTIAL' : 'CREDIT');
    const category = (saleItems[0]?.category) || 'Eggs';
    const date = sale.saleDate || sale.createdAt || new Date();
    const invoiceNumber = sale.invoiceNumber || '';
    const shopId = sale.shopId || shopIds[0];

    try {
      await pool.query(
        `INSERT INTO ${ledgerTable} 
         (shopId, saleId, invoiceNumber, customerName, customerPhone, category, itemsDescription, petisBought, eggsBought, totalAmount, cashPaid, bankPaid, dueAmount, paymentMethod, status, date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          shopId,
          saleId,
          invoiceNumber,
          sale.customerName || 'Walk-in Customer',
          sale.customerPhone || '',
          category,
          itemsDescription,
          petisBought,
          eggsBought,
          totalAmount,
          cashPaid,
          bankPaid,
          dueAmount,
          sale.paymentMethod || 'CASH',
          status,
          date
        ]
      );
      inserted++;
    } catch (insertErr) {
      console.log(`   ⚠️ Failed to insert sale ${saleId}: ${insertErr.message}`);
    }
  }

  console.log(`   ✅ Inserted: ${inserted} | Skipped (already exist): ${skipped}`);
}

async function main() {
  console.log('🚀 د Customer Payment Ledger Sync Script پيل شو...');
  console.log('================================================');

  for (const branch of BRANCHES) {
    await syncBranch(branch.prefix, branch.shopIds);
  }

  console.log('\n================================================');
  console.log('✅ Sync بشپړ شو! اوس customer ledger او sales report سم ښيي.');
  process.exit(0);
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
