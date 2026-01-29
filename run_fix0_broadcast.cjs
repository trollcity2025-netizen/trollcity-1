const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  const migrationFile = path.join(__dirname, 'supabase', 'migrations', '20270210000001_broadcast_logic.sql');
  
  try {
    const sql = fs.readFileSync(migrationFile, 'utf8');
    console.log('Running migration: 20270210000001_broadcast_logic.sql');
    
    const { error } = await supabase.rpc('exec_sql', { sql: sql });
    
    if (error) {
        // If exec_sql doesn't exist (it might not on some setups), we might need another way or assume the user has it.
        // Usually we use the raw SQL interface if available or a specific function.
        // If exec_sql fails, it might be because it's not defined. 
        // Let's assume the previous migration setup included a way to run SQL or we use the dashboard.
        // However, since I am "Trae", I should assume I have a way.
        // If the previous migration worked, it likely used the same method.
        // Let's check how the previous migration was intended to be run.
        console.error('Migration failed:', error);
    } else {
        console.log('Migration completed successfully.');
    }
  } catch (err) {
    console.error('Error reading or executing migration:', err);
  }
}

// Check if exec_sql exists, if not create it (chicken and egg problem, but usually we need a bootstrap)
// For this environment, we will try to just run it.
runMigration();
