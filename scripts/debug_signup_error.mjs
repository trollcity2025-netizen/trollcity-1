
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yjxpwfalenorzrqxwmtr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAyOTExNywiZXhwIjoyMDc5NjA1MTE3fQ.Ra1AhVwUYPxODzeFnCnWyurw8QiTzO0OeCo-sXzTVHo'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
  console.log('--- Checking vehicles_catalog ---')
  const { data: cars, error: carError } = await supabase
    .from('vehicles_catalog')
    .select('id, name, tier, price, slug')
    .ilike('tier', 'starter')
  
  if (carError) console.error('Error fetching cars:', carError)
  else console.log('Starter cars found:', cars)

  console.log('\n--- Checking Triggers on auth.users ---')
  // We can't query pg_trigger directly via API usually unless we use rpc with a privileged function
  // Assuming 'exec_sql' exists from previous context
  const { data: triggers, error: triggerError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT 
        trigger_name, 
        event_manipulation, 
        event_object_schema, 
        event_object_table, 
        action_statement 
      FROM information_schema.triggers 
      WHERE event_object_table IN ('users', 'user_profiles')
    `
  })

  if (triggerError) {
      console.error('Error fetching triggers (might need direct SQL):', triggerError)
      
      // Fallback: Try to query pg_trigger directly if we have permission via rpc
      const { data: rawTriggers, error: rawTriggerError } = await supabase.rpc('exec_sql', {
          sql: `
            SELECT tgname, tgrelid::regclass 
            FROM pg_trigger 
            WHERE tgrelid::regclass::text IN ('auth.users', 'public.user_profiles');
          `
      })
      if (rawTriggerError) console.error('Error fetching raw triggers:', rawTriggerError)
      else console.log('Raw Triggers:', rawTriggers)
      
  } else {
      console.log('Triggers:', triggers)
  }
  
  console.log('\n--- Checking handle_user_signup definition ---')
   const { data: funcDef, error: funcError } = await supabase.rpc('exec_sql', {
    sql: `
      select prosrc 
      from pg_proc 
      where proname = 'handle_user_signup';
    `
  })
  
  if (funcError) console.error('Error fetching function def:', funcError)
  else console.log('Function Definition:', funcDef)
}

debug()
