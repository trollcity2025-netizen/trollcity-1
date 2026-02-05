
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role to bypass RLS

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Fetching one stream to inspect columns...');
  const { data: streams, error } = await supabase
    .from('streams')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching streams:', error);
  } else if (streams.length > 0) {
    console.log('Stream columns:', Object.keys(streams[0]));
  } else {
    console.log('No streams found. Cannot inspect columns directly from data.');
    // Try to insert with a dummy column to see error message listing valid columns? No, that's messy.
    // We will assume 'user_id' and 'broadcaster_id' might be needed.
  }

  console.log('Fetching a user to be the broadcaster...');
  const { data: users, error: userError } = await supabase
    .from('user_profiles')
    .select('id, username')
    .limit(1);

  if (userError) {
    console.error('Error fetching users:', userError);
  } else if (users.length > 0) {
    console.log('Found user:', users[0]);
  } else {
    console.log('No users found in user_profiles.');
  }
}

main();
