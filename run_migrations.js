const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:HWyB3aYqOOZjr8jP@db.yjxpwfalenorzrqxwmtr.supabase.co:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runMigration(sql) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration applied successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const files = [
    'fix_extension_and_materialized_view.sql',
    'fix_rls_policies.sql', 
    'fix_all_search_paths.sql'
  ];
  
  for (const file of files) {
    console.log(`\n=== Running ${file} ===`);
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    await runMigration(sql);
  }
  
  await pool.end();
}

main().catch(console.error);
