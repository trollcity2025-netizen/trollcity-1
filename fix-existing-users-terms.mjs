#!/usr/bin/env node
/**
 * Fix existing users - set terms_accepted to true for users who are already using the app
 * New users will get terms_accepted = false and need to accept terms
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function main() {
  console.log('🔧 Fixing terms_accepted for existing users...\n')

  try {
    // Get all users where terms_accepted is null or not set
    const { data: users, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, username, created_at, terms_accepted')
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('❌ Error fetching users:', fetchError)
      return
    }

    console.log(`📊 Found ${users?.length || 0} total users\n`)

    // Filter users who need updating (null or undefined terms_accepted)
    const needsUpdate = users?.filter(u => u.terms_accepted === null || u.terms_accepted === undefined) || []
    
    console.log(`🔍 Users with null/undefined terms_accepted: ${needsUpdate.length}`)
    console.log(`✅ Users who already accepted: ${(users?.length || 0) - needsUpdate.length}\n`)

    if (needsUpdate.length === 0) {
      console.log('✨ All users already have terms_accepted set!')
      return
    }

    // Update all existing users to terms_accepted = true (they're already using the app)
    console.log('📝 Setting terms_accepted = true for existing users...\n')
    
    let updated = 0
    for (const user of needsUpdate) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          terms_accepted: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) {
        console.error(`❌ Failed to update ${user.username || user.id}:`, updateError.message)
      } else {
        updated++
        console.log(`✅ ${updated}/${needsUpdate.length} - Updated ${user.username || user.id}`)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('Summary:')
    console.log('='.repeat(60))
    console.log(`Total Users: ${users?.length || 0}`)
    console.log(`Updated: ${updated}`)
    console.log(`Already Set: ${(users?.length || 0) - needsUpdate.length}`)
    console.log('='.repeat(60))
    console.log('\n✨ Done! Existing users won\'t see terms agreement.')
    console.log('📌 New users will need to accept terms on first login.\n')

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

main()
