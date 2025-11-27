import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

async function fixAdmin() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    console.log('Getting all auth users...')
    
    // Find user in auth.users by email
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      console.error('Users error:', usersError)
      return
    }
    
    const adminUser = users.find(u => u.email?.toLowerCase() === 'trollcity2025@gmail.com')
    
    if (!adminUser) {
      console.log('❌ No user found with email trollcity2025@gmail.com')
      return
    }
    
    console.log('✅ Found auth user:', adminUser.id, adminUser.email)
    
    // Now check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', adminUser.id)
      .maybeSingle()
    
    if (profileError) {
      console.error('Profile error:', profileError)
      return
    }
    
    if (!profile) {
      console.log('No profile exists, creating one...')
      
      const { data: created, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: adminUser.id,
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
        console.error('❌ Create error:', createError)
      } else {
        console.log('✅ SUCCESS! Admin profile created:', created[0])
      }
      return
    }
    
    console.log('Current profile role:', profile.role)
    
    if (profile.role === 'admin') {
      console.log('✅ Already admin!')
      return
    }
    
    // Update to admin
    const { data: updated, error: updateError } = await supabase
      .from('user_profiles')
      .update({ role: 'admin', updated_at: new Date().toISOString() })
      .eq('id', adminUser.id)
      .select()
    
    if (updateError) {
      console.error('❌ Update error:', updateError)
    } else {
      console.log('✅ SUCCESS! Role updated to admin')
      console.log('New profile:', updated[0])
    }
  } catch (err) {
    console.error('Fatal error:', err)
  }
}

fixAdmin()
