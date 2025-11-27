// Run this with: node fix-admin.js
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('URL:', supabaseUrl)
console.log('Key starts with:', serviceRoleKey?.substring(0, 20))

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function fixAdmin() {
  console.log('Searching for trollcity2025@gmail.com...')
  
  // Find the user by email
  const { data: profiles, error: searchError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', 'trollcity2025@gmail.com')
  
  if (searchError) {
    console.error('Search error:', searchError)
    return
  }
  
  console.log('Found profiles:', profiles)
  
  if (!profiles || profiles.length === 0) {
    console.log('No profile found. Checking auth.users...')
    
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      console.error('Users error:', usersError)
      return
    }
    
    const adminUser = users.find(u => u.email === 'trollcity2025@gmail.com')
    console.log('Admin user from auth:', adminUser)
    
    if (adminUser) {
      console.log('Creating profile for user:', adminUser.id)
      const { data: created, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: adminUser.id,
          email: 'trollcity2025@gmail.com',
          username: 'trollcity2025',
          role: 'admin',
          tier: 'Platinum',
          paid_coin_balance: 10000,
          free_coin_balance: 10000,
          total_earned_coins: 0,
          total_spent_coins: 0,
          avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
          bio: 'Admin Account',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
      
      if (createError) {
        console.error('Create error:', createError)
      } else {
        console.log('✅ ADMIN PROFILE CREATED:', created)
      }
    }
    return
  }
  
  // Update existing profile
  const profile = profiles[0]
  console.log('Updating profile:', profile.id)
  
  const { data: updated, error: updateError } = await supabase
    .from('user_profiles')
    .update({
      role: 'admin',
      updated_at: new Date().toISOString()
    })
    .eq('id', profile.id)
    .select()
  
  if (updateError) {
    console.error('❌ UPDATE ERROR:', updateError)
  } else {
    console.log('✅ ADMIN ROLE UPDATED:', updated)
  }
}

fixAdmin().then(() => {
  console.log('\n✅ Done! Now refresh your browser.')
  process.exit(0)
}).catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
