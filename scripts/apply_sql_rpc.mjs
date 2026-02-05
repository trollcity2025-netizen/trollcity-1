
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

// We can't run raw SQL via supabase-js client directly unless we have an RPC for it.
// However, we can try to use the REST API to call a function if it exists.
// Or we can assume we have direct DB access or use a specific connection string if provided.
// Since I don't have the connection string in the env vars (only URL and Key), 
// I have to rely on an existing RPC 'exec_sql' or similar, OR just hope the user has it.
// Many Supabase setups include an exec_sql function for admin tasks.

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySql() {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    console.error('Please provide SQL file path');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`Applying SQL from ${sqlPath}...`);

  // Try to use exec_sql RPC
  const { error } = await supabase.rpc('exec_sql', { sql: sql });

  if (error) {
    console.error('RPC exec_sql failed:', error);
    console.log('Attempting fallback: creating a temporary function via another method? No, impossible via client.');
    console.log('Please run this SQL manually in the Supabase Dashboard SQL Editor:');
    console.log('---------------------------------------------------');
    console.log(sql);
    console.log('---------------------------------------------------');
  } else {
    console.log('Successfully applied SQL via exec_sql!');
  }
}

applySql();
