
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkBankTiers() {
  const { data, error } = await supabase.from('bank_tiers').select('*');
  console.log(JSON.stringify({ data, error }, null, 2));
}

checkBankTiers();
