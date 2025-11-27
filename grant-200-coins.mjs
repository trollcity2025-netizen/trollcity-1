import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function grantCoinsToAllUsers() {
  console.log('🪙 Granting 200 free coins to all users...')

  try {
    // Get all user profiles
    const { data: users, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, username, free_coin_balance')

    if (fetchError) {
      console.error('Error fetching users:', fetchError)
      process.exit(1)
    }

    console.log(`Found ${users.length} users`)

    let updated = 0
    let failed = 0

    // Update each user's free coin balance
    for (const user of users) {
      const newBalance = (user.free_coin_balance || 0) + 200

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ free_coin_balance: newBalance })
        .eq('id', user.id)

      if (updateError) {
        console.error(`Failed to update user ${user.username || user.id}:`, updateError)
        failed++
      } else {
        console.log(`✅ ${user.username || user.id}: ${user.free_coin_balance || 0} → ${newBalance} coins`)
        updated++
      }
    }

    console.log(`\n✨ Complete! Updated ${updated} users, ${failed} failed`)
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exit(1)
  }
}

grantCoinsToAllUsers()
