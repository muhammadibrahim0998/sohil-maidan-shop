import pool from '../config/db.js';

async function run() {
  const branchPrefixes = ['peshawar_branch', 'mardan_branch', 'attock_branch'];
  for (const pfx of branchPrefixes) {
    try {
      const [res] = await pool.query(`DELETE FROM \`${pfx}__expenses\` WHERE title LIKE 'Supplier %'`);
      console.log(`Cleaned up ${res.affectedRows} supplier payment rows from ${pfx}__expenses`);
    } catch (e) {
      console.error(`Error on ${pfx}:`, e.message);
    }
  }
  process.exit(0);
}

run();
