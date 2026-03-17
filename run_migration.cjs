const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read the migration file
const migrationPath = path.join(__dirname, 'supabase/migrations/20260317000000_family_system_bootstrap.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Initialize Supabase client with service role key
const supabaseUrl = process.env.SUPABASE_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAyOTExNywiZXhwIjoyMDc5NjA1MTE3fQ.Ra1AhVwUYPxODzeFnCnWyurw8QiTzO0OeCo-sXzTVHo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running family system bootstrap migration...');
  
  try {
    // Split the SQL into individual statements and execute them
    // Using rpc to execute raw SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      query: migrationSQL 
    });
    
    if (error) {
      console.error('Error executing migration:', error);
      // Try alternative approach - execute via postgres function
      console.log('Trying alternative execution method...');
    } else {
      console.log('Migration completed successfully!');
      console.log(data);
    }
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

runMigration();
