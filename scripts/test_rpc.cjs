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
  const { data: _data, error } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1' });
  if (error) {
    console.error('exec_sql failed:', error);
  } else {
    console.log('exec_sql works!');
  }
}

test();
