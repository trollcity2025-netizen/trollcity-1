
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load env vars
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);

if (!dbUrlMatch) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrlMatch[1],
});

async function checkTables() {
  try {
    await client.connect();
    console.log('Connected to database.');

    // Check entrance_effects for "Cookie" or "Pizza"
    console.log('\nChecking entrance_effects for "Cookie":');
    const res1 = await client.query(`
      SELECT * FROM entrance_effects WHERE name = 'Cookie' OR name = 'Pizza'
    `);
    if (res1.rows.length > 0) {
        console.log('FOUND in entrance_effects:', res1.rows);
    } else {
        console.log('NOT FOUND in entrance_effects');
    }

    // Check if entrance_effects is a view
    const res2 = await client.query(`
      SELECT table_type FROM information_schema.tables WHERE table_name = 'entrance_effects'
    `);
    console.log('\nentrance_effects type:', res2.rows[0]?.table_type);

    // Check purchasable_items again
    const res3 = await client.query(`
        SELECT count(*) FROM purchasable_items WHERE category = 'gift'
    `);
    console.log('purchasable_items gift count:', res3.rows[0].count);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkTables();
