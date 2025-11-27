import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yjxpwfalenorzrqxwmtr.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAyOTExNywiZXhwIjoyMDc5NjA1MTE3fQ.Ra1AhVwUYPxODzeFnCnWyurw8QiTzO0OeCo-sXzTVHo'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
})

async function createSupportTicketsTable() {
  console.log('\n=== CREATING SUPPORT TICKETS TABLE ===\n')

  try {
    // Test if we can create directly via SQL
    console.log('Creating support_tickets table with complete schema...\n')

    const createTableSQL = `
-- Drop existing table if any
DROP TABLE IF EXISTS public.support_tickets CASCADE;

-- Create support_tickets table with all required columns
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text,
  email text,
  subject text,
  category text DEFAULT 'general',
  message text,
  body text,
  status text NOT NULL DEFAULT 'open',
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT SELECT ON public.support_tickets TO anon;
`

    // Try using the SQL editor endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: createTableSQL })
    })

    if (!response.ok) {
      console.log('Direct SQL execution not available, creating via inserts...\n')
      
      // Alternative: Just try to insert a test record to see if table exists
      const { data: testInsert, error: testError } = await supabase
        .from('support_tickets')
        .insert([{
          user_id: '00000000-0000-0000-0000-000000000000',
          username: 'test',
          email: 'test@test.com',
          subject: 'Test',
          category: 'general',
          message: 'Test message',
          status: 'open'
        }])
        .select()

      if (testError) {
        console.error('❌ Error creating/testing table:', testError.message)
        console.log('\n⚠️  MANUAL ACTION REQUIRED:')
        console.log('Please run the following SQL in your Supabase SQL Editor:\n')
        console.log(createTableSQL)
      } else {
        console.log('✅ Table exists and is writable!')
        
        // Delete test record
        await supabase
          .from('support_tickets')
          .delete()
          .eq('user_id', '00000000-0000-0000-0000-000000000000')
      }
    } else {
      console.log('✅ Table created successfully!')
    }

    // Try to verify table structure
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .limit(0)

    if (error) {
      console.log('\n❌ Table verification failed:', error.message)
      console.log('\n📋 Please copy and run this SQL in Supabase SQL Editor:\n')
      console.log(createTableSQL)
    } else {
      console.log('\n✅ Support tickets table is ready!')
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:')
    console.log(`
-- Create support_tickets table
DROP TABLE IF EXISTS public.support_tickets CASCADE;

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text,
  email text,
  subject text,
  category text DEFAULT 'general',
  message text,
  body text,
  status text NOT NULL DEFAULT 'open',
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT SELECT ON public.support_tickets TO anon;
    `)
  }

  console.log('\n=== DONE ===\n')
}

createSupportTicketsTable()
