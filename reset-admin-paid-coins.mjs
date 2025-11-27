import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yjxpwfalenorzrqxwmtr.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAyOTExNywiZXhwIjoyMDc5NjA1MTE3fQ.Ra1AhVwUYPxODzeFnCnWyurw8QiTzO0OeCo-sXzTVHo'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function resetAdminPaidCoins() {
  console.log('\n=== RESETTING ADMIN PAID COINS ===\n')

  // Get admin account
  const { data: admin, error: fetchError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('role', 'admin')
    .single()

  if (fetchError || !admin) {
    console.error('❌ Error fetching admin:', fetchError)
    return
  }

  console.log('Current Admin Balance:')
  console.log(`  Username: ${admin.username}`)
  console.log(`  Paid Coins: ${admin.paid_coin_balance}`)
  console.log(`  Free Coins: ${admin.free_coin_balance}`)
  console.log(`  Total Earned: ${admin.total_earned_coins}`)
  console.log(`  Total Spent: ${admin.total_spent_coins}`)

  // Reset paid coins to 0
  const { data: updated, error: updateError } = await supabase
    .from('user_profiles')
    .update({ 
      paid_coin_balance: 0,
      total_earned_coins: admin.free_coin_balance // Reset to only free coins
    })
    .eq('role', 'admin')
    .select()
    .single()

  if (updateError) {
    console.error('\n❌ Error updating admin:', updateError)
    return
  }

  console.log('\n✅ Admin paid coins reset successfully!')
  console.log('\nNew Admin Balance:')
  console.log(`  Username: ${updated.username}`)
  console.log(`  Paid Coins: ${updated.paid_coin_balance}`)
  console.log(`  Free Coins: ${updated.free_coin_balance}`)
  console.log(`  Total Earned: ${updated.total_earned_coins}`)
  console.log(`  Total Spent: ${updated.total_spent_coins}`)
}

resetAdminPaidCoins().catch(console.error)
