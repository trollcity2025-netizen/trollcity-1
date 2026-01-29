const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration(filePath) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Applying migration: ${path.basename(filePath)}`);
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error(`Migration ${path.basename(filePath)} failed:`, error);
      return false;
    } else {
      console.log(`Migration ${path.basename(filePath)} applied successfully!`);
      return true;
    }
  } catch (err) {
    console.error('Error reading migration file:', err);
    return false;
  }
}

async function runAll() {
  const migrations = [
    'supabase/migrations/20270210000002_housing_rpcs.sql',
    'supabase/migrations/20270210000003_fix_bank_loans.sql',
    'supabase/migrations/20270210000004_admin_week_logic.sql'
  ];

  for (const file of migrations) {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        await runMigration(fullPath);
    } else {
        console.warn(`File not found: ${fullPath}`);
    }
  }
}

runAll();
