
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkRLS() {
  await client.connect();
  
  try {
    // Check tables with RLS disabled
    const rlsDisabled = await client.query(`
      SELECT schemaname, tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND rowsecurity = false;
    `);

    console.log('\n--- Tables with RLS DISABLED ---');
    if (rlsDisabled.rows.length === 0) {
        console.log('All public tables have RLS enabled.');
    } else {
        rlsDisabled.rows.forEach(row => console.log(`${row.schemaname}.${row.tablename}`));
    }

    // Check policies
    const policies = await client.query(`
      SELECT schemaname, tablename, policyname, cmd, roles 
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);

    console.log('\n--- Existing Policies ---');
    let currentTable = '';
    policies.rows.forEach(row => {
        if (row.tablename !== currentTable) {
            console.log(`\n[${row.tablename}]`);
            currentTable = row.tablename;
        }
        console.log(`  - ${row.policyname} (${row.cmd}) -> ${row.roles}`);
    });

  } catch (err) {
    console.error('Error checking RLS:', err);
  } finally {
    await client.end();
  }
}

checkRLS();
