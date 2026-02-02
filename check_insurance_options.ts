
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOptions() {
  const { data, error } = await supabase.from('insurance_options').select('id, name, duration_hours, cost');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Insurance Options:', JSON.stringify(data, null, 2));
  }
}

checkOptions();
