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

const users = [
  {
    email: 'admin@test.com',
    username: 'admin_test',
    role: 'admin',
    is_admin: true,
    is_troll_officer: false,
    is_lead_officer: false,
    is_officer_active: false,
  },
  {
    email: 'secretary@test.com',
    username: 'secretary_test',
    role: 'secretary',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_officer_active: false,
  },
  {
    email: 'lead.troll@test.com',
    username: 'lead_troll_test',
    role: 'lead_troll_officer',
    is_admin: false,
    is_troll_officer: true,
    is_lead_officer: true,
    is_officer_active: true,
  },
  {
    email: 'officer@test.com',
    username: 'troll_officer_test',
    role: 'troll_officer',
    is_admin: false,
    is_troll_officer: true,
    is_lead_officer: false,
    is_officer_active: true,
  },
  {
    email: 'user@test.com',
    username: 'user_test',
    role: 'user',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_officer_active: false,
  },
  {
    email: 'chatter1@test.com',
    username: 'chatter1_test',
    role: 'user',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_officer_active: false,
    is_broadcaster: true,
  },
  {
    email: 'chatter2@test.com',
    username: 'chatter2_test',
    role: 'user',
    is_admin: false,
    is_troll_officer: false,
    is_lead_officer: false,
    is_officer_active: false,
  },
];

async function getUserIdByEmail(email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200, page: 1 });
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
    full_name: 'Test User',
    gender: 'male',
    role: user.role,
    is_admin: user.is_admin,
    is_troll_officer: user.is_troll_officer,
    is_lead_officer: user.is_lead_officer,
    is_officer_active: user.is_officer_active,
    troll_coins: 1000,
    total_earned_coins: 1000,
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
    full_name: 'Test User',
    legal_full_name: 'Test User',
    tax_verification_status: 'approved',
    status: 'approved',
    w9_status: 'approved',
    submitted_at: new Date().toISOString(),
  };

  const { error: taxError } = await supabase
    .from('user_tax_info')
    .upsert(taxPayload, { onConflict: 'user_id' });

  if (taxError) throw taxError;

  return userId;
}

async function main() {
  for (const user of users) {
    const userId = await createOrUpdateUser(user);
    console.log(`Seeded ${user.email} (${userId})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
