import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yjxpwfalenorzrqxwmtr.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAyOTExNywiZXhwIjoyMDc5NjA1MTE3fQ.Ra1AhVwUYPxODzeFnCnWyurw8QiTzO0OeCo-sXzTVHo'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkUsers() {
  console.log('\n=== CHECKING ALL USERS ===\n')

  // Check user_profiles table
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (profileError) {
    console.error('Error fetching profiles:', profileError)
    return
  }

  console.log(`📊 Total users in user_profiles: ${profiles?.length || 0}\n`)
  
  if (profiles && profiles.length > 0) {
    console.log('User Details:')
    profiles.forEach((user, index) => {
      console.log(`\n${index + 1}. Username: @${user.username || 'N/A'}`)
      console.log(`   Role: ${user.role || 'user'}`)
      console.log(`   Tier: ${user.tier || 'bronze'}`)
      console.log(`   Level: ${user.level || 1}`)
      console.log(`   XP: ${user.xp || 0}`)
      console.log(`   Paid Coins: ${user.paid_coin_balance || 0}`)
      console.log(`   Free Coins: ${user.free_coin_balance || 0}`)
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`)
      console.log(`   ID: ${user.id}`)
    })
  }

  // Check auth.users
  console.log('\n\n=== AUTH SYSTEM USERS ===\n')
  const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers()

  if (authError) {
    console.error('Error fetching auth users:', authError)
    return
  }

  console.log(`🔐 Total users in auth system: ${authUsers?.length || 0}\n`)
  
  if (authUsers && authUsers.length > 0) {
    console.log('Auth User Details:')
    authUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. Email: ${user.email || 'N/A'}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Created: ${new Date(user.created_at || '').toLocaleString()}`)
      console.log(`   Last Sign In: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}`)
    })
  }

  // Compare
  console.log('\n\n=== COMPARISON ===')
  console.log(`Profiles in database: ${profiles?.length || 0}`)
  console.log(`Users in auth: ${authUsers?.length || 0}`)
  
  const orphanedAuth = authUsers?.filter(au => !profiles?.find(p => p.id === au.id)) || []
  const orphanedProfiles = profiles?.filter(p => !authUsers?.find(au => au.id === p.id)) || []
  
  if (orphanedAuth.length > 0) {
    console.log(`\n⚠️  ${orphanedAuth.length} auth users WITHOUT profiles:`)
    orphanedAuth.forEach(u => console.log(`   - ${u.email} (${u.id})`))
  }
  
  if (orphanedProfiles.length > 0) {
    console.log(`\n⚠️  ${orphanedProfiles.length} profiles WITHOUT auth users:`)
    orphanedProfiles.forEach(u => console.log(`   - @${u.username} (${u.id})`))
  }
  
  if (orphanedAuth.length === 0 && orphanedProfiles.length === 0) {
    console.log('\n✅ All users are synced between auth and profiles!')
  }
}

checkUsers().catch(console.error)
