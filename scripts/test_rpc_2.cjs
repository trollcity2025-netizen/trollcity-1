const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  console.log('Testing with param "query"...');
  const { data: _d1, error: e1 } = await supabase.rpc('exec_sql', { query: 'SELECT 1' });
  if (!e1) {
    console.log('Success with "query"!');
    return;
  }
  console.log('Failed with "query":', e1.message);

  console.log('Testing with param "sql"...');
  const { data: _d2, error: e2 } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
  if (!e2) {
    console.log('Success with "sql"!');
    return;
  }
  console.log('Failed with "sql":', e2.message);
  
  console.log('Testing with param "sql_query"...');
  const { data: _d3, error: e3 } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1' });
  if (!e3) {
    console.log('Success with "sql_query"!');
    return;
  }
  console.log('Failed with "sql_query":', e3.message);
}

test();
