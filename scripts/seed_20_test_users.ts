/**
 * Expanded Test User Seeder
 * Creates 20 test users with 10 different roles for comprehensive testing
 * 
 * Roles:
 * 1. admin - Full system access
 * 2. secretary - Secretary dashboard access
 * 3. lead_troll_officer - Lead officer access
 * 4. troll_officer - Officer dashboard access
 * 5. broadcaster - Can broadcast
 * 6. family_leader - Family leader access
 * 7. troller - Special troller role
 * 8. president - President test persona (stored as member role + label)
 * 9. pastor - Pastor role
 * 10. member - Regular member
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const password = process.env.TEST_USER_PASSWORD || 'Test123!@#';

// 20 users with 10 different roles
const users = [
  // Role 1: Admin (2 users)
  {
    email: 'admin1@test.com',
    username: 'admin_test_1',
    role: 'admin',
    is_admin: true,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Admin - Full system access',
  },
  {
    email: 'admin2@test.com',
    username: 'admin_test_2',
    role: 'admin',
    is_admin: true,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Admin - Secondary admin',
  },
  // Role 2: Secretary (2 users)
  {
    email: 'secretary1@test.com',
    username: 'secretary_test_1',
    role: 'secretary',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Secretary - Secretary dashboard access',
  },
  {
    email: 'secretary2@test.com',
    username: 'secretary_test_2',
    role: 'secretary',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Secretary - Secondary secretary',
  },
  // Role 3: Lead Troll Officer (2 users)
  {
    email: 'lead_officer1@test.com',
    username: 'lead_officer_test_1',
    role: 'lead_troll_officer',
    is_admin: false,
    is_troll_officer: true,
    is_lead_officer: true,
    is_pastor: false,
    role_description: 'Lead Troll Officer - Lead officer dashboard access',
  },
  {
    email: 'lead_officer2@test.com',
    username: 'lead_officer_test_2',
    role: 'lead_troll_officer',
    is_admin: false,
    is_troll_officer: true,
    is_lead_officer: true,
    is_pastor: false,
    role_description: 'Lead Troll Officer - Secondary lead officer',
  },
  // Role 4: Troll Officer (2 users)
  {
    email: 'officer1@test.com',
    username: 'officer_test_1',
    role: 'troll_officer',
    is_admin: false,
    is_troll_officer: true,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Troll Officer - Officer dashboard access',
  },
  {
    email: 'officer2@test.com',
    username: 'officer_test_2',
    role: 'troll_officer',
    is_admin: false,
    is_troll_officer: true,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Troll Officer - Secondary officer',
  },
  // Role 5: Broadcaster (2 users)
  {
    email: 'broadcaster1@test.com',
    username: 'broadcaster_test_1',
    role: 'broadcaster',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Broadcaster - Can broadcast',
  },
  {
    email: 'broadcaster2@test.com',
    username: 'broadcaster_test_2',
    role: 'broadcaster',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Broadcaster - Secondary broadcaster',
  },
  // Role 6: Family Leader (2 users)
  {
    email: 'family_leader1@test.com',
    username: 'family_leader_test_1',
    role: 'family_leader',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Family Leader - Family leader access',
  },
  {
    email: 'family_leader2@test.com',
    username: 'family_leader_test_2',
    role: 'family_leader',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Family Leader - Secondary family leader',
  },
  // Role 7: Troller (2 users)
  {
    email: 'troller1@test.com',
    username: 'troller_test_1',
    role: 'troller',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Troller - Special troller role',
  },
  {
    email: 'troller2@test.com',
    username: 'troller_test_2',
    role: 'troller',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Troller - Secondary troller',
  },
  // Role 8: President (2 users)
  {
    email: 'president1@test.com',
    username: 'president_test_1',
    role: 'member',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'President - President role',
  },
  {
    email: 'president2@test.com',
    username: 'president_test_2',
    role: 'member',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'President - Secondary president',
  },
  // Role 9: Pastor (2 users)
  {
    email: 'pastor1@test.com',
    username: 'pastor_test_1',
    role: 'member',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: true,
    role_description: 'Pastor - Pastor role (is_pastor flag)',
  },
  {
    email: 'pastor2@test.com',
    username: 'pastor_test_2',
    role: 'member',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: true,
    role_description: 'Pastor - Secondary pastor',
  },
  // Role 10: Member (2 users)
  {
    email: 'member1@test.com',
    username: 'member_test_1',
    role: 'member',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Member - Regular member',
  },
  {
    email: 'member2@test.com',
    username: 'member_test_2',
    role: 'member',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Member - Secondary member',
  },
  // Legacy users (kept for backward compatibility with older smoke specs)
  {
    email: 'admin@test.com',
    username: 'admin_legacy_test',
    role: 'admin',
    is_admin: true,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Legacy Admin',
  },
  {
    email: 'secretary@test.com',
    username: 'secretary_legacy_test',
    role: 'secretary',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Legacy Secretary',
  },
  {
    email: 'lead.troll@test.com',
    username: 'lead_officer_legacy_test',
    role: 'lead_troll_officer',
    is_admin: false,
    is_troll_officer: true,
    is_lead_officer: true,
    is_pastor: false,
    role_description: 'Legacy Lead Troll Officer',
  },
  {
    email: 'officer@test.com',
    username: 'officer_legacy_test',
    role: 'troll_officer',
    is_admin: false,
    is_troll_officer: true,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Legacy Troll Officer',
  },
  {
    email: 'user@test.com',
    username: 'user_legacy_test',
    role: 'member',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_pastor: false,
    role_description: 'Legacy Member',
  },
];

async function getUserIdByEmail(email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 500, page: 1 });
  if (error) throw error;

  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return match?.id || null;
}

async function createOrUpdateUser(user: typeof users[number]) {
  let userId = await getUserIdByEmail(user.email);

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: {
        username: user.username,
      },
    });

    if (error) throw error;
    userId = data.user?.id || null;
  }

  if (!userId) {
    throw new Error(`Failed to resolve user id for ${user.email}`);
  }

  const profilePayload = {
    id: userId,
    email: user.email,
    username: user.username,
    full_name: user.role_description,
    gender: 'male',
    role: user.role,
    is_admin: user.is_admin,
    is_troll_officer: user.is_troll_officer,
    is_lead_officer: user.is_lead_officer,
    is_pastor: user.is_pastor,
    troll_coins: 10000,
    total_earned_coins: 10000,
    total_spent_coins: 0,
    is_test_user: true,
    terms_accepted: true,
    court_recording_consent: true,
    court_recording_consent_at: new Date().toISOString(),
  };

  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert(profilePayload, { onConflict: 'id' });

  if (profileError) throw profileError;

  const taxPayload = {
    user_id: userId,
    full_name: user.role_description,
    legal_full_name: user.role_description,
    tax_verification_status: 'approved',
    status: 'approved',
    w9_status: 'approved',
    submitted_at: new Date().toISOString(),
  };

  const { error: taxError } = await supabase
    .from('user_tax_info')
    .upsert(taxPayload, { onConflict: 'user_id' });

  if (taxError) console.warn('Tax info error (non-critical):', taxError);

  return { userId, user };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Creating 20 test users with 10 different roles...');
  console.log('='.repeat(60));
  
  const results: Array<{ success: boolean; userId?: string; user?: typeof users[number]; email?: string; error?: string }> = [];
  
  for (const user of users) {
    try {
      const result = await createOrUpdateUser(user);
      results.push({ success: true, ...result });
      console.log(`✓ Created ${user.role_description}: ${user.email}`);
    } catch (error) {
      results.push({ success: false, email: user.email, error: String(error) });
      console.error(`✗ Failed to create ${user.email}:`, error);
    }
  }

  // Ensure battle-eligible broadcasters have at least one follower for Trollmers tests.
  const byEmail = new Map(
    results.filter((r) => r.success && r.user).map((r) => [r.user!.email, r.userId!])
  );
  const followPairs = [
    { follower: 'member1@test.com', following: 'broadcaster1@test.com' },
    { follower: 'member2@test.com', following: 'broadcaster2@test.com' },
    { follower: 'user@test.com', following: 'broadcaster1@test.com' },
  ];

  for (const pair of followPairs) {
    const followerId = byEmail.get(pair.follower);
    const followingId = byEmail.get(pair.following);
    if (!followerId || !followingId) continue;
    const { error } = await supabase
      .from('user_follows')
      .upsert(
        {
          follower_id: followerId,
          following_id: followingId,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'follower_id,following_id' }
      );
    if (error) {
      console.warn(`Follower seed warning (${pair.follower} -> ${pair.following}):`, error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total users: ${users.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  
  // Group by role
  const roleCounts: Record<string, number> = {};
  for (const user of users) {
    roleCounts[user.role] = (roleCounts[user.role] || 0) + 1;
  }
  console.log('\nUsers by role:');
  for (const [role, count] of Object.entries(roleCounts)) {
    console.log(`  ${role}: ${count}`);
  }
  
  console.log('\nTest credentials (password: ' + password + '):');
  for (const user of users) {
    console.log(`  ${user.role}: ${user.email}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Test users seeded successfully!');
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
