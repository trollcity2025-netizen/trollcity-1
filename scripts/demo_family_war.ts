
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load env vars from root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runDemo() {
  console.log('\n=== STARTING FAMILY WARS DEMO ===\n')

  // 1. Get Families
  const { data: families, error: famError } = await supabase
    .from('troll_families')
    .select('id, name, leader_id')
    .limit(2)
  
  if (famError) {
    console.error('Error fetching families:', famError)
    return
  }

  let famA, famB
  if (!families || families.length < 2) {
    console.log('> Less than 2 families found. Creating a demo family...')
    
    // We have at least 1 family?
    const existingFam = families?.[0]
    
    // Find a user to be leader of new family
    let { data: users } = await supabase
      .from('profiles')
      .select('id')
      .neq('id', existingFam?.leader_id || '00000000-0000-0000-0000-000000000000')
      .limit(1)
      
    if (!users || users.length === 0) {
      console.log('> No available users found. Creating a dummy user...')
      const email = `demo_user_${Date.now()}@example.com`
      const password = 'password123'
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })
      
      if (authError) {
        console.error('Failed to create dummy user:', authError)
        return
      }
      
      const userId = authData.user.id
      console.log(`> Created dummy user: ${userId}`)
      
      // Wait for profile trigger
      await new Promise(r => setTimeout(r, 2000))
      
      // Check if profile exists, if not create it manually (just in case trigger failed/missing)
      const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).single()
      if (!profile) {
        console.log('> Profile not created by trigger, creating manually...')
         const { error: profileError } = await supabase.from('profiles').insert({
           id: userId,
           username: `User_${userId.substring(0,6)}`,
           email
         })
         if (profileError) console.error('Profile creation error:', profileError)
       }
       
       users = [{ id: userId }]
     }
     
     const newLeaderId = users[0].id
     const newFamName = `DemoFam_${Math.floor(Math.random() * 1000)}`
     
     const { data: newFam, error: createError } = await supabase
       .from('troll_families')
       .insert({
         name: newFamName,
         family_name: newFamName,
         leader_id: newLeaderId,
         description: 'Temporary demo family'
       })
       .select()
       .single()
       
     if (createError) {
       console.error('Failed to create demo family:', createError)
       return
     }
     console.log(`> Created new family: ${newFam.name}`)
     
     famA = existingFam || newFam
     famB = existingFam ? newFam : (await supabase.from('troll_families').select().neq('id', newFam.id).single()).data
   } else {
     famA = families[0]
     famB = families[1]
   }
   console.log(`> Families selected for war:`)
   console.log(`  [A] ${famA.name} (ID: ${famA.id})`)
   console.log(`  [B] ${famB.name} (ID: ${famB.id})`)

  // 2. Get a User (to be the declarer)
  let declarerUser
  const { data: existingUsers, error: _userError } = await supabase
    .from('profiles')
    .select('id, username')
    .limit(1)
  
  if (existingUsers && existingUsers.length > 0) {
    declarerUser = existingUsers[0]
  } else {
    console.log('> No profiles found. checking auth users...')
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers()
    
    if (authUsers && authUsers.length > 0) {
      console.log(`> Found ${authUsers.length} auth users. Creating profile for first one...`)
       const u = authUsers[0]
       const { error: pError } = await supabase.from('profiles').insert({
         id: u.id,
         username: `User_${u.id.substring(0,6)}`
         // email removed as column might be missing
       })
       if (pError) console.error('Profile create error:', pError)
       declarerUser = { id: u.id, username: `User_${u.id.substring(0,6)}` }
     } else {
       console.log('> Creating new user for declaration...')
       const email = `declarer_${Date.now()}@test.com`
       const { data: authData, error: authError } = await supabase.auth.admin.createUser({
         email,
         password: 'password123',
         email_confirm: true
       })
       if (authError) {
         console.error('Auth create error:', authError)
         return
       }
       const u = authData.user
       await supabase.from('profiles').insert({
         id: u.id,
         username: `Declarer_${u.id.substring(0,6)}`
         // email removed
       })
       declarerUser = { id: u.id, username: `Declarer_${u.id.substring(0,6)}` }
     }
   }

   const user = declarerUser
   console.log(`\n> User executing action: ${user.username}`)

  // 3. Declare War
  // Short duration for demo
  const startsAt = new Date()
  const endsAt = new Date(Date.now() + 5 * 60 * 1000) // 5 mins from now

  // Sync families to 'families' table if needed (fix for FK constraint)
  console.log('\n> Syncing families to "families" table to satisfy FKs...');
  try {
    const familiesToSync = [famA, famB].map(f => ({
      id: f.id,
      name: f.name || f.family_name || 'Unknown Family',
      // Add other potential columns if needed, but keep it minimal
    }));
    
    const { error: syncError } = await supabase
      .from('families')
      .upsert(familiesToSync);
      
    if (syncError) {
      console.warn('  Warning: Could not sync to "families" table:', syncError.message);
      // Continue anyway, maybe it's not needed or will fail later
    } else {
      console.log('  Synced families successfully.');
    }
  } catch (err) {
    console.warn('  Sync step failed:', err);
  }

  console.log('\n> Declaring War (probing schema)...')
  // Try minimal insert first
  const { data: war, error: warError } = await supabase
    .from('family_wars')
    .insert({
      family_a_id: famA.id,
      family_b_id: famB.id,
      attacking_family_id: famA.id,
      defending_family_id: famB.id,
      status: 'active',
      end_time: endsAt.toISOString()
    })
    .select()
    .single()

  if (warError) {
    console.error('Failed to declare war:', warError)
    return
  }
  console.log(`  War Declared! ID: ${war.id}`)
  console.log(`  Row keys: ${Object.keys(war).join(', ')}`)
  
  // If we get here, update with times if columns exist?
  // We can't update if columns don't exist.
  // We check if keys include ends_at
  if (war.ends_at !== undefined) {
      console.log('  Updating times...')
      await supabase.from('family_wars').update({
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString()
      }).eq('id', war.id)
  } else {
      console.log('  WARNING: ends_at column missing!')
  }
  console.log(`  War Declared! ID: ${war.id}`)
  console.log(`  Status: ${war.status}`)

  // 4. Simulate Scoring
  console.log('\n> Simulating battle activity...')
  
  // Fam A scores
  const scoreA1 = 50
  const { error: scoreError1 } = await supabase.from('family_war_scores').upsert({
    war_id: war.id,
    family_id: famA.id,
    score: scoreA1,
    updated_at: new Date().toISOString()
  })
  if (scoreError1) console.error('  Error scoring A1:', scoreError1)
  else console.log(`  [${new Date().toLocaleTimeString()}] ${famA.name} attacks! Score: ${scoreA1}`)

  // Fam B scores
  await new Promise(r => setTimeout(r, 1000))
  const scoreB1 = 80
  const { error: scoreError2 } = await supabase.from('family_war_scores').upsert({
    war_id: war.id,
    family_id: famB.id,
    score: scoreB1,
    updated_at: new Date().toISOString()
  })
  if (scoreError2) console.error('  Error scoring B1:', scoreError2)
  else console.log(`  [${new Date().toLocaleTimeString()}] ${famB.name} counter-attacks! Score: ${scoreB1}`)

  // Fam A scores again
  await new Promise(r => setTimeout(r, 1000))
  const scoreA2 = 120
  const { error: scoreError3 } = await supabase.from('family_war_scores').upsert({
    war_id: war.id,
    family_id: famA.id,
    score: scoreA2, // Cumulative
    updated_at: new Date().toISOString()
  })
  if (scoreError3) console.error('  Error scoring A2:', scoreError3)
  else console.log(`  [${new Date().toLocaleTimeString()}] ${famA.name} heavy hit! Score: ${scoreA2}`)

  // 5. Wait for war to end
  console.log('\n> Waiting for war timer to expire...')
  await new Promise(r => setTimeout(r, 2500))

  // 6. Complete War
  console.log('> Time up! Checking completion...')
  
  // Logic from completeWar
  const { data: finalScores } = await supabase
    .from('family_war_scores')
    .select('family_id, score')
    .eq('war_id', war.id)

  // if (!finalScores || finalScores.length === 0) {
  //   console.log('  (Simulation: using in-memory scores due to missing DB table)')
  //   finalScores = [
  //     { family_id: famA.id, score: 120 },
  //     { family_id: famB.id, score: 80 }
  //   ]
  // }

  let winnerId = null
  let maxScore = -1
  
  if (finalScores) {
    finalScores.forEach(s => {
      if (s.score > maxScore) {
        maxScore = s.score
        winnerId = s.family_id
      }
    })
  }

  // Update war status
  const { error: updateError } = await supabase
    .from('family_wars')
    .update({
      status: 'completed',
      winner_family_id: winnerId,
      end_time: new Date().toISOString()
    })
    .eq('id', war.id)

  if (updateError) {
    console.error('Error completing war:', updateError)
  } else {
    console.log('\n=== WAR RESULTS ===')
    const winnerName = winnerId === famA.id ? famA.name : famB.name
    // const loserName = winnerId === famA.id ? famB.name : famA.name
    const scores = finalScores || []
    const loserScore = scores.find(s => s.family_id !== winnerId)?.score || 0
    
    console.log(`Winner: ${winnerName} 🏆`)
    console.log(`Final Score: ${maxScore} - ${loserScore}`)
  }
  
  console.log('\nDemo Complete.')
}

runDemo().catch(console.error)
