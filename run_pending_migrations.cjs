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

async function runMigration(fileName) {
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', fileName);
  
  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`Applying migration: ${fileName}`);
    
    const { error } = await supabase.rpc('exec_sql', { sql: sql });

    if (error) {
      console.error(`Migration ${fileName} failed:`, error);
      // Try with sql_query parameter just in case (older version of exec_sql?)
      if (error.code === 'PGRST202') {
         console.log('Retrying with sql_query parameter...');
         const { error: retryError } = await supabase.rpc('exec_sql', { sql_query: sql });
         if (retryError) {
            console.error(`Retry failed:`, retryError);
         } else {
            console.log(`Migration ${fileName} applied successfully (retry)!`);
         }
      }
    } else {
      console.log(`Migration ${fileName} applied successfully!`);
    }
  } catch (err) {
    console.error(`Error reading/applying ${fileName}:`, err);
  }
}

async function runAll() {
    // Order matters
    await runMigration('20270210000002_housing_rpcs.sql');
    await runMigration('20270210000003_fix_bank_loans.sql');
    await runMigration('20270210000004_admin_week_logic.sql');
    await runMigration('20270210000005_moderation_tools.sql');
}

runAll();
