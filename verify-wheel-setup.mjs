#!/usr/bin/env node
/**
 * Verify and populate wheel-related columns for all users
 * Ensures admin dashboard shows accurate real-time data
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
  console.log('🔍 Checking user profiles for wheel columns...\n')

  try {
    // Check if columns exist by trying to select them
    const { data: testProfile, error: testError } = await supabase
      .from('user_profiles')
      .select('id, badge, has_insurance, multiplier_active, multiplier_value, multiplier_expires, terms_accepted')
      .limit(1)
      .maybeSingle()

    if (testError) {
      console.error('❌ Missing columns detected:', testError.message)
      console.log('\n⚠️  Please run the migration: supabase/migrations/20251126_add_wheel_columns.sql')
      console.log('   1. Copy the migration content')
      console.log('   2. Go to Supabase Dashboard → SQL Editor')
      console.log('   3. Paste and run the migration\n')
      return
    }

    console.log('✅ All required columns exist\n')

    // Get all user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError)
      return
    }

    console.log(`📊 Found ${profiles?.length || 0} user profiles\n`)

    // Check for null values and update if needed
    let updatedCount = 0
    for (const profile of profiles || []) {
      const updates = {}
      let needsUpdate = false

      // Ensure default values for wheel columns
      if (profile.badge === null) {
        updates.badge = null // Keep as null, it's fine
      }
      if (profile.has_insurance === null) {
        updates.has_insurance = false
        needsUpdate = true
      }
      if (profile.multiplier_active === null) {
        updates.multiplier_active = false
        needsUpdate = true
      }
      if (profile.multiplier_value === null) {
        updates.multiplier_value = 1
        needsUpdate = true
      }
      if (profile.terms_accepted === null) {
        updates.terms_accepted = false
        needsUpdate = true
      }

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', profile.id)

        if (updateError) {
          console.error(`❌ Failed to update profile ${profile.username || profile.id}:`, updateError.message)
        } else {
          console.log(`✅ Updated ${profile.username || profile.id}`)
          updatedCount++
        }
      }
    }

    console.log(`\n✅ Updated ${updatedCount} profiles with default values`)

    // Check wheel_spins table
    const { count: spinsCount, error: spinsError } = await supabase
      .from('wheel_spins')
      .select('*', { count: 'exact', head: true })

    if (spinsError) {
      console.log('\n⚠️  wheel_spins table may not exist:', spinsError.message)
      console.log('   Run migration: supabase/migrations/20251126_add_wheel_columns.sql\n')
    } else {
      console.log(`\n📊 Total wheel spins recorded: ${spinsCount || 0}`)
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('Summary:')
    console.log('='.repeat(60))
    console.log(`Total Users: ${profiles?.length || 0}`)
    console.log(`Profiles Updated: ${updatedCount}`)
    console.log(`Total Spins: ${spinsCount || 0}`)
    console.log('='.repeat(60))

    // Show sample profile
    if (profiles && profiles.length > 0) {
      console.log('\n📋 Sample Profile:')
      const sample = profiles[0]
      console.log({
        username: sample.username,
        free_coins: sample.free_coin_balance,
        paid_coins: sample.paid_coin_balance,
        badge: sample.badge || 'none',
        has_insurance: sample.has_insurance,
        multiplier_active: sample.multiplier_active
      })
    }

    console.log('\n✨ Done! Admin dashboard should now reflect real-time updates.')

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

main()
