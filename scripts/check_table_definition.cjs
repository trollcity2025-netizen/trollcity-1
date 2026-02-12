const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTable() {
  // Check if entrance_effects is a table or view
  // We can't easily check definition via JS client without SQL function, 
  // but we can check if inserting into it works and what columns it has.
  
  // We can try to inspect information_schema via RPC if available, or just assume based on behavior.
  // But let's try to select from information_schema.tables
  
  const { data, error } = await supabase
    .from('entrance_effects')
    .select('*')
    .eq('category', 'gift')
    .limit(5);

  if (error) {
    console.error('Error selecting from entrance_effects:', error);
  } else {
    console.log('Gifts found in entrance_effects:', data);
  }
}

checkTable();
