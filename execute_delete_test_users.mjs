import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  console.error('   Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function deleteTestUsers() {
  try {
    console.log('🔍 Checking for test accounts...')
    console.log('   Criteria: usernames starting with "user"')
    console.log('')

    // First, count how many test users exist
    const { data: testUsers, error: countError } = await supabase
      .from('user_profiles')
      .select('id, username, email')
      .ilike('username', 'user%')

    if (countError) {
      console.error('❌ Error fetching test users:', countError.message)
      process.exit(1)
    }

    if (!testUsers || testUsers.length === 0) {
      console.log('✅ No test accounts found with usernames starting with "user"')
      return
    }

    console.log(`⚠️  Found ${testUsers.length} test account(s) to delete:`)
    testUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.username} (${user.email || 'no email'})`)
    })
    console.log('')

    // Delete test users
    console.log('🗑️  Deleting test accounts...')
    console.log('')

    const deletedProfiles = []
    const deletedAuth = []
    const errors = []

    for (const user of testUsers) {
      try {
        // Delete from user_profiles first (cascades to related tables)
        const { error: profileError } = await supabase
          .from('user_profiles')
          .delete()
          .eq('id', user.id)

        if (profileError) {
          // Check if it's a foreign key constraint error
          if (profileError.message.includes('foreign key constraint')) {
            console.log(`   ⚠️  ${user.username}: Has related records, attempting force delete...`)
            // Try to delete related records first
            await cleanupRelatedRecords(supabase, user.id)
            
            // Retry delete
            const { error: retryError } = await supabase
              .from('user_profiles')
              .delete()
              .eq('id', user.id)
            
            if (retryError) {
              errors.push({ user: user.username, error: retryError.message })
              continue
            }
          } else {
            errors.push({ user: user.username, error: profileError.message })
            continue
          }
        }

        deletedProfiles.push(user.username)

        // Delete from auth.users using admin API
        const { error: authError } = await supabase.auth.admin.deleteUser(user.id)
        
        if (authError) {
          console.log(`   ⚠️  Could not delete auth user ${user.username}: ${authError.message}`)
        } else {
          deletedAuth.push(user.username)
        }

        console.log(`   ✅ Deleted: ${user.username}`)

      } catch (err) {
        errors.push({ user: user.username, error: err.message })
      }
    }

    console.log('')
    console.log('📊 DELETION SUMMARY')
    console.log('===================')
    console.log(`   Test accounts deleted from user_profiles: ${deletedProfiles.length}`)
    console.log(`   Test accounts deleted from auth.users: ${deletedAuth.length}`)
    
    if (errors.length > 0) {
      console.log('')
      console.log('❌ ERRORS:')
      errors.forEach(({ user, error }) => {
        console.log(`   - ${user}: ${error}`)
      })
    }

    // Get remaining user count
    const { count: remainingCount, error: remainingError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    if (!remainingError) {
      console.log(`   Remaining users in database: ${remainingCount}`)
    }

    console.log('')
    console.log('✅ Test account cleanup complete!')

  } catch (error) {
    console.error('❌ Execution failed:', error.message)
    process.exit(1)
  }
}

async function cleanupRelatedRecords(supabase, userId) {
  // Clean up common related tables that might have FK constraints
  const tables = [
    'coin_transactions',
    'payout_requests',
    'user_tax_info',
    'user_credit',
    'badge_user',
    'user_badges',
    'owned_badges',
    'streams',
    'stream_moderators',
    'battle_queue',
    'troll_battles',
    'loan_applications',
    'loans',
    'properties',
    'leases',
    'rent_payments',
    'vehicle_listings',
    'vehicle_bids',
    'user_cars',
    'town_player_state',
    'house_raid_attempts',
    'family_members',
    'conversation_members',
    'messages',
    'daily_login_wall_posts',
    'post_views',
    'referrals',
    'creator_migration_claims',
    'trolls_night_applications',
    'contest_submissions',
    'pitch_contests_votes',
    'officer_vote_cycles',
    'officer_votes',
    'officer_assignments',
    'broadcast_officers',
    'stream_seat_sessions',
    'stream_messages',
    'stream_bans',
    'stream_mutes',
    'stream_reports',
    'court_cases',
    'court_dockets',
    'court_summons',
    'warrants',
    'action_logs',
    'system_errors',
    'moderation_actions_log',
    'admin_queue',
    'admin_pool_transactions',
    'manual_coin_orders',
    'coin_ledger',
    'live_sessions',
    'live_session_transactions',
    'pay_per_minute_sessions',
    'admin_oversight_logs',
    'admin_oversight_flags'
  ]

  for (const table of tables) {
    try {
      // Try to delete where user_id matches
      await supabase.from(table).delete().eq('user_id', userId)
    } catch {
      // Ignore errors - table might not exist or have different column name
    }

    try {
      // Try other common FK column names
      await supabase.from(table).delete().eq('owner_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('broadcaster_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('officer_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('sender_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('receiver_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('player1_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('player2_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('defendant_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('plaintiff_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('accuser_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('guest_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('seller_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('bidder_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('raider_user_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('applicant_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('tenant_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('voter_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('actor_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('target_user_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('processed_by', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('reviewed_by', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('granted_by', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('revoked_by', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('ended_by', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('resolved_by', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('reverted_by', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('winner_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('reporter_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('interviewer_id', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('created_by', userId)
    } catch {}

    try {
      await supabase.from(table).delete().eq('updated_by', userId)
    } catch {}
  }
}

// Run the deletion
deleteTestUsers()
