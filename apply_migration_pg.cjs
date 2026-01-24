const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for migrations

if (!process.env.DATABASE_URL && (!supabaseUrl || !supabaseKey)) {
  console.error('Error: DATABASE_URL is missing AND (SUPABASE_URL+SERVICE_KEY) are missing.');
  process.exit(1);
}

let supabase;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
}

async function applyMigration(filePath) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Applying migration: ${filePath}`);

    // Split SQL into statements if necessary, or just run as one block if supported
    // supabase-js rpc might be needed if direct sql execution isn't available via client
    // But typically we can't run raw SQL via supabase-js client unless we have a specific function.
    // However, for this environment, we might need to use a different approach if we don't have a 'exec_sql' RPC.
    // Let's assume we have a 'exec_sql' RPC or similar, OR we use the pg driver directly.
    // Since I cannot install new packages easily, I will try to use the 'pg' module if available, 
    // or fall back to a known RPC if one exists. 
    // actually, let's try to use the 'pg' library if it is available in the environment.
    
    // Wait, the previous attempt used a script I supposedly created. 
    // Let's try to use the 'postgres' or 'pg' library if available.
    // If not, I will rely on the user having an 'exec_sql' function or similar.
    // BUT, since I am in a "Trae IDE" environment, I might not have 'pg' installed.
    // I will try to use the `supabase-js` client to call a hypothetical `exec_sql` function.
    // If that fails, I will print instructions.
    
    // Actually, I'll check if I can use Deno style imports in a .mjs file since I see Deno in edge functions.
    // But I am running in Node.js environment (PowerShell).
    
    // Let's try to use a direct connection string if I can find it.
    // The environment has 'DATABASE_URL'.
    
    if (process.env.DATABASE_URL) {
        console.log("Using DATABASE_URL with 'pg' (if available)...");
        try {
            const { Client } = require('pg');
            const client = new Client({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });
            await client.connect();
            await client.query(sql);
            await client.end();
            console.log("Migration applied successfully via pg.");
            return;
        } catch (e) {
            console.error("Failed to use 'pg':", e.message);
            // Fallback to supabase rpc
        }
    }

    // Fallback: Try to use a system function if available, or just log that we need to run it.
    console.log("Attempting to run via Supabase RPC 'exec_sql' (if exists)...");
    
    if (!supabase) {
         console.error('Supabase keys missing, cannot use RPC fallback.');
         process.exit(1);
    }

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
        // If exec_sql doesn't exist, we might be stuck without a direct SQL runner.
        // I'll print the SQL to be run.
        console.error('Error applying migration via RPC:', error);
        console.log('Please run the following SQL manually in your Supabase SQL Editor:');
        console.log(sql);
        process.exit(1);
    }

    console.log('Migration applied successfully via RPC.');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node apply_migration_pg.cjs <path_to_sql_file>');
  process.exit(1);
}

applyMigration(migrationFile);
