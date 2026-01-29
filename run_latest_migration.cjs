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
    
    // Attempt 1: exec_sql with { sql }
    let { error } = await supabase.rpc('exec_sql', { sql: sql });

    if (error) {
       // Attempt 2: direct query if exec_sql fails (not possible via client usually unless enabled)
       // But usually the issue is parameter name. Some versions use 'query', 'sql_query', etc.
       // Let's try 'query'
       if (error.message && error.message.includes('argument')) {
            console.log('Retrying with "query" parameter...');
            const { error: retryError } = await supabase.rpc('exec_sql', { query: sql });
            error = retryError;
       }
    }

    if (error) {
      console.error(`Migration ${fileName} failed:`, error);
    } else {
      console.log(`Migration ${fileName} applied successfully!`);
    }
  } catch (err) {
    console.error(`Error reading/applying ${fileName}:`, err);
  }
}

async function runAll() {
    await runMigration('20270210000006_car_valuation.sql');
}

runAll();
