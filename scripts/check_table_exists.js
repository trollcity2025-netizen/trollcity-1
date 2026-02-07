
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function check() {
  console.log('Checking if officer_pay_ledger exists...')
  
  // Try to select from it
  const { data, error } = await supabase.from('officer_pay_ledger').select('count', { count: 'exact', head: true })
  
  if (error) {
    console.error('Error selecting from table:', error)
  } else {
    console.log('Table exists! Count:', data) // data is null for head:true usually, but count is in count property
  }

  // Also check via RPC if we can
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_officer_payroll_stats')
  if (rpcError) {
    console.error('RPC get_officer_payroll_stats failed:', rpcError)
  } else {
    console.log('RPC get_officer_payroll_stats works:', rpcData)
  }
}

check()
