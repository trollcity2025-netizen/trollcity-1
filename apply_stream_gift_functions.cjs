const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  const sqlPath = path.join(__dirname, 'supabase', 'migrations', 'create_stream_gift_functions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying stream gift functions migration...');
  console.log('SQL:', sql);

  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    if (statement.trim()) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        if (error) {
          console.log('Trying direct query approach...');
          // Try using the REST API directly
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ sql: statement + ';' })
          });
          
          if (!response.ok) {
            const text = await response.text();
            console.log('Response:', text);
          }
        }
      } catch (err) {
        console.log('Statement execution note:', err.message);
      }
    }
  }

  console.log('\nMigration file created. Please apply this SQL manually in Supabase Dashboard:');
  console.log('1. Go to SQL Editor in Supabase Dashboard');
  console.log('2. Paste the contents of: supabase/migrations/create_stream_gift_functions.sql');
  console.log('3. Execute the SQL');
}

applyMigration().catch(console.error);