
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const connectionString = process.env.DATABASE_URL;
const client = new Client({ connectionString });

async function run() {
  try {
    await client.connect();
    
    // Get a user
    const userRes = await client.query('SELECT id, created_at, troll_coins FROM user_profiles LIMIT 1');
    if (userRes.rows.length === 0) {
        console.log('No users found');
        return;
    }
    const user = userRes.rows[0];
    console.log('Testing with user:', user);

    // Call RPC
    // Note: Calling as postgres user (superuser) so it bypasses RLS, 
    // but the function is SECURITY DEFINER so it runs as owner anyway.
    // However, the issue might be related to permissions when called via API.
    
    // We can simulate the call
    const rpcRes = await client.query(`
        SELECT public.troll_bank_apply_for_loan($1, $2) as result
    `, [user.id, 100]); // Request 100 coins
    
    console.log('RPC Result:', JSON.stringify(rpcRes.rows[0], null, 2));

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await client.end();
  }
}

run();
