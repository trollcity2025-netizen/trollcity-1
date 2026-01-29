const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Running complete fix implementation migration...');

    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20270210000000_complete_fix_implementation.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolon to run statements individually if needed, but exec_sql usually handles blocks
    // However, exec_sql might have issues with DO $$ blocks if not handled correctly. 
    // Usually it takes the whole string.

    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      console.error('Migration failed:', error);
      // Try fallback: create the exec_sql function if it doesn't exist? 
      // No, we can't create it if we can't run SQL.
      // But maybe the error is just a permission thing or something else.
      if (error.message.includes('function "exec_sql" does not exist')) {
         console.error('exec_sql RPC not found. Please run the migration manually in Supabase SQL Editor.');
      }
      process.exit(1);
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Error running migration:', err);
    process.exit(1);
  }
}

runMigration();
