
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

async function checkEntranceEffects() {
  try {
    await client.connect();
    console.log('Connected to database.');

    // Check count and categories
    const res1 = await client.query(`
      SELECT category, COUNT(*) as count 
      FROM entrance_effects 
      GROUP BY category
    `);
    
    console.log('\nEntrance Effects Categories:');
    if (res1.rows.length === 0) {
      console.log('  (Table is empty)');
    } else {
      res1.rows.forEach(row => {
        console.log(`  ${row.category}: ${row.count} items`);
      });
    }

    // Check specifically for non-gift items (e.g. 'female_style')
    const res2 = await client.query(`
        SELECT name FROM entrance_effects WHERE category = 'female_style' LIMIT 5
    `);
    if (res2.rows.length > 0) {
        console.log('\nFound female_style effects:', res2.rows.map(r => r.name).join(', '));
    } else {
        console.log('\nNo female_style effects found.');
    }

  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await client.end();
  }
}

checkEntranceEffects();
