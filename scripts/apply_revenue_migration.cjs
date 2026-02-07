require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function apply() {
  if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not set in .env');
      process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
  });

  try {
    await client.connect();
    const sqlPath = path.join(__dirname, '../database/migrations/002_revenue_inventory_sync.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running revenue migration...');
    await client.query(sql);
    console.log('Revenue migration applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

apply();
