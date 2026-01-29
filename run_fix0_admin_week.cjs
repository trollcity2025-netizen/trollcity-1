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
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Prefer service role for migrations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20270210000004_admin_week_logic.sql');
  
  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`Applying migration: ${path.basename(migrationPath)}`);
    
    // We use the exec_sql RPC if available, or just raw query if possible with service role?
    // The previous turn used exec_sql. Let's assume it exists.
    // If not, we might need to use the SQL editor or a direct connection.
    // However, since we are using the JS client, we rely on the RPC 'exec_sql' created in the setup.
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('Migration failed:', error);
    } else {
      console.log('Migration applied successfully!');
    }
  } catch (err) {
    console.error('Error reading migration file:', err);
  }
}

runMigration();
