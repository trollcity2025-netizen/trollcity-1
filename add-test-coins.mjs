// Quick script to add test coins for manual payout testing
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function addTestCoins() {
  try {
    const adminEmail = 'trollcity2025@gmail.com'
    
    // Find admin user
    const { data: authUser, error: authError } = await supabase.auth.admin.listUsers()
    if (authError) throw authError
    
    const admin = authUser.users.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase())
    if (!admin) {
      console.error('❌ Admin user not found:', adminEmail)
      process.exit(1)
    }
    
    console.log('✅ Found admin user:', admin.id)
    
    // Add 50,000 paid coins for testing (enough for multiple cashout tiers)
    const testCoins = 50000
    
    const { data: updated, error: updateError } = await supabase
      .from('user_profiles')
      .update({ 
        paid_coin_balance: testCoins,
        updated_at: new Date().toISOString()
      })
      .eq('id', admin.id)
      .select()
      .single()
    
    if (updateError) throw updateError
    
    console.log('✅ Added test coins to admin account')
    console.log('   User ID:', admin.id)
    console.log('   Email:', adminEmail)
    console.log('   Paid Coins:', testCoins.toLocaleString())
    console.log('')
    console.log('💰 You can now test cashout requests!')
    console.log('   Available tiers:')
    console.log('   - 7,000 coins → $21')
    console.log('   - 14,000 coins → $49.50')
    console.log('   - 27,000 coins → $90')
    console.log('   - 47,000 coins → $155')
    console.log('')
    console.log('📍 Go to /earnings to submit a cashout request')
    console.log('📍 View it in Admin Dashboard → Manual Cashouts tab')
    
  } catch (error) {
    console.error('❌ Error:', error.message || error)
    process.exit(1)
  }
}

addTestCoins()
