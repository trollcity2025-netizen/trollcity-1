import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yjxpwfalenorzrqxwmtr.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  console.error('Please set it in your .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixProfiles() {
  console.log('Checking all users...\n')

  // Get all users from auth
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
  
  if (usersError) {
    console.error('Error fetching users:', usersError)
    return
  }

  console.log(`Found ${users.length} users in auth.users\n`)

  for (const user of users) {
    console.log(`\nChecking user: ${user.email} (${user.id})`)
    
    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error(`  Error checking profile:`, profileError)
      continue
    }

    if (!profile) {
      console.log(`  ❌ No profile found - creating one...`)
      
      const username = user.user_metadata?.username || 
                      user.app_metadata?.username || 
                      user.email.split('@')[0]

      // Create profile
      const { data: newProfile, error: createError} = await supabase
        .from('user_profiles')
        .insert([{
          id: user.id,
          username: username,
          role: user.email === 'trollcity2025@gmail.com' ? 'admin' : 'user'
        }])
        .select()
        .single()

      if (createError) {
        console.error(`  ❌ Failed to create profile:`, createError)
      } else {
        console.log(`  ✅ Created profile with username: ${username}`)
      }
    } else {
      console.log(`  ✅ Profile exists`)
      console.log(`     Username: ${profile.username || 'NULL'}`)
      console.log(`     Role: ${profile.role}`)
      console.log(`     Coins: ${profile.paid_coin_balance} paid, ${profile.free_coin_balance} free`)
      
      // Update username if missing
      if (!profile.username || profile.username.trim() === '') {
        const username = user.user_metadata?.username || 
                        user.app_metadata?.username || 
                        user.email.split('@')[0]
        
        console.log(`  ⚠️  Username is missing - updating to: ${username}`)
        
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ username: username, updated_at: new Date().toISOString() })
          .eq('id', user.id)

        if (updateError) {
          console.error(`  ❌ Failed to update username:`, updateError)
        } else {
          console.log(`  ✅ Username updated`)
        }
      }
    }
  }

  console.log('\n✅ Profile check complete!')
}

fixProfiles().catch(console.error)
