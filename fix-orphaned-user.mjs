import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yjxpwfalenorzrqxwmtr.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAyOTExNywiZXhwIjoyMDc5NjA1MTE3fQ.Ra1AhVwUYPxODzeFnCnWyurw8QiTzO0OeCo-sXzTVHo'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fixOrphanedUser() {
  console.log('\n=== FIXING ORPHANED USER ===\n')

  const userId = '8d8b6a4f-d990-495f-8a2b-3de5ee7739c9'
  const email = 'udryve2025@gmail.com'
  const username = 'udryve2025'

  // Create profile for the orphaned auth user
  const { data, error } = await supabase
    .from('user_profiles')
    .insert([{
      id: userId,
      username: username,
      avatar_url: '',
      bio: '',
      role: 'user',
      tier: 'Bronze',
      paid_coin_balance: 0,
      free_coin_balance: 0,
      total_earned_coins: 0,
      total_spent_coins: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()

  if (error) {
    console.error('❌ Error creating profile:', error)
    return
  }

  console.log('✅ Profile created successfully for udryve2025@gmail.com')
  console.log('   Username: @' + username)
  console.log('   User ID:', userId)
  console.log('\nUser is now registered in the admin dashboard!')
}

fixOrphanedUser().catch(console.error)
