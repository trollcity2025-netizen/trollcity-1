
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is missing');
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
});

async function run() {
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM bank_tiers');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await client.end();
  }
}

run();
