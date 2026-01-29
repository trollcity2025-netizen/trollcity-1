const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20270210000003_fix_bank_loans.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration: 20270210000003_fix_bank_loans.sql');

  const { error } = await supabase.rpc('exec_sql', { sql: sql });

  if (error) {
    console.error('Migration failed:', error);
  } else {
    console.log('Migration applied successfully!');
  }
}

runMigration();
