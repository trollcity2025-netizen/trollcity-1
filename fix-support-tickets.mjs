import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = 'https://yjxpwfalenorzrqxwmtr.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAyOTExNywiZXhwIjoyMDc5NjA1MTE3fQ.Ra1AhVwUYPxODzeFnCnWyurw8QiTzO0OeCo-sXzTVHo'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixSupportTickets() {
  console.log('\n=== FIXING SUPPORT TICKETS TABLE ===\n')

  try {
    // Read migration file
    const migrationSQL = readFileSync(
      join(process.cwd(), 'supabase', 'migrations', '20251126_fix_support_tickets.sql'),
      'utf-8'
    )

    console.log('Applying migration...\n')

    // Execute migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

    if (error) {
      // If rpc doesn't exist, try direct approach
      console.log('RPC not available, using direct approach...\n')
      
      // Add columns one by one
      const alterations = [
        `ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS username text`,
        `ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS email text`,
        `ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS category text DEFAULT 'general'`,
        `ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS message text`,
        `ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS admin_response text`,
        `CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status)`,
        `CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC)`,
      ]

      for (const sql of alterations) {
        console.log(`Executing: ${sql.substring(0, 80)}...`)
        const { error: execError } = await supabase.rpc('exec_sql', { sql })
        if (execError) {
          console.log(`  ⚠️  Note: ${execError.message}`)
        } else {
          console.log(`  ✅ Done`)
        }
      }
    } else {
      console.log('✅ Migration applied successfully!')
    }

    // Verify the table structure
    console.log('\n📊 Verifying table structure...\n')
    
    const { data: tableInfo, error: infoError } = await supabase
      .from('support_tickets')
      .select('*')
      .limit(1)

    if (infoError) {
      console.log('Error checking table:', infoError.message)
    } else {
      console.log('✅ Support tickets table is accessible')
      if (tableInfo && tableInfo.length > 0) {
        console.log('Sample columns:', Object.keys(tableInfo[0]))
      }
    }

  } catch (error) {
    console.error('Error:', error)
  }

  console.log('\n=== DONE ===\n')
}

fixSupportTickets()
