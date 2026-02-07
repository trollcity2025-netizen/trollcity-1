import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function testGas() {
  // 1. Get a test user
  const { data: users, error: userError } = await supabase.from('user_profiles').select('id, username').limit(1);
  if (userError || !users || users.length === 0) {
    console.error('No users found');
    return;
  }
  const userId = users[0].id;
  console.log(`Testing with user: ${users[0].username} (${userId})`);

  // 2. Set gas to 0 manually to start clean
  await supabase.from('user_profiles').update({ gas_balance: 0 }).eq('id', userId);
  
  // 3. Call refill_gas as the user
  // We need to act as the user. Since we are using service role, we can use rpc but auth.uid() will be null unless we impersonate or use a different client.
  // Using service role with rpc usually requires auth.uid() to work if the RPC relies on it.
  // The RPCs use `auth.uid()`.
  
  // We need to sign in or use setSession? Service role bypasses RLS but `auth.uid()` inside PL/pgSQL might be null.
  // Actually, we can just use `supabase.auth.admin.getUserById` but that doesn't sign them in for RPC context.
  
  // Let's modify the RPCs to accept user_id for testing? No, that changes the code.
  // Let's sign in a test user if we can, or just use `postgres` to run SQL directly.
  
  // Alternative: Login as the user using password? I don't know the password.
  
  // I will use `rpc` with `supabase.auth.signInWithPassword` if I knew a user.
  // Since I don't, I'll use SQL to simulate the calls or check the logic.
  
  // Wait, I can just use `postgres` role via SQL to execute the function logic directly.
  
  console.log('--- Simulating via SQL ---');
  
  // Refill
  const { data: refillData, error: refillError } = await supabase.rpc('refill_gas', { p_amount_percent: 100 });
  // This will fail because auth.uid() is null.
  
  console.log('Refill result (expected failure):', refillData, refillError);

}

// I'll write a SQL script instead to run via `psql` if I had it, or use a tool that can execute SQL.
// I have `apply_migration_pg.cjs` which can run SQL.
