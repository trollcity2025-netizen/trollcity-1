
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
  const { data, error } = await supabase.rpc('exec_sql', { sql: sql });

  if (error) {
    console.error('RPC exec_sql failed:', error);
    console.log('Please run this SQL manually in the Supabase Dashboard SQL Editor:');
    console.log('---------------------------------------------------');
    console.log(sql);
    console.log('---------------------------------------------------');
  } else {
    console.log('Successfully applied SQL via exec_sql!');
    console.log('Result:', data);
  }
}

applySql();
