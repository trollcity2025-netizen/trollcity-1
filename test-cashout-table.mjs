// Test if cashout_requests table exists and has proper permissions
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testCashoutTable() {
  try {
    console.log('🔍 Testing cashout_requests table...\n')
    
    // Try to select from the table
    const { data, error } = await supabase
      .from('cashout_requests')
      .select('id')
      .limit(1)
    
    if (error) {
      if (error.code === '42P01') {
        console.error('❌ TABLE DOES NOT EXIST')
        console.error('   Error:', error.message)
        console.log('\n📋 SOLUTION:')
        console.log('   1. Go to your Supabase project dashboard')
        console.log('   2. Click on "SQL Editor" in the left sidebar')
        console.log('   3. Click "New Query"')
        console.log('   4. Copy the contents of ensure-cashout-table.sql')
        console.log('   5. Paste into the editor and click "Run"')
        console.log('')
        return
      }
      
      if (error.code === '42501') {
        console.error('❌ PERMISSION DENIED')
        console.error('   Error:', error.message)
        console.log('\n📋 SOLUTION:')
        console.log('   RLS policies may be blocking access.')
        console.log('   Run ensure-cashout-table.sql in Supabase SQL Editor')
        console.log('')
        return
      }
      
      console.error('❌ ERROR:', error.message)
      console.error('   Code:', error.code)
      return
    }
    
    console.log('✅ cashout_requests table exists and is accessible!')
    console.log(`   Found ${data?.length || 0} existing requests\n`)
    console.log('💰 You can now submit cashout requests from /earnings page')
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

testCashoutTable()
