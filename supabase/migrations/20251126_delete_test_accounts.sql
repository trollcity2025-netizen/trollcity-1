-- =====================================================
-- Delete All Test/Fake Accounts - Production Cleanup
-- Created: 2025-11-26
-- Purpose: Remove all test accounts before deployment
-- =====================================================

-- Delete test users marked with is_test_user flag
DELETE FROM auth.users 
WHERE id IN (
  SELECT id FROM public.user_profiles 
  WHERE is_test_user = true
);

-- Delete profiles for test users
DELETE FROM public.user_profiles 
WHERE is_test_user = true;

-- Delete any users with test emails or usernames
DELETE FROM auth.users 
WHERE email LIKE '%test%' 
   OR email LIKE '%fake%'
   OR email LIKE '%demo%'
   OR email LIKE '%example%';

-- Delete corresponding profiles
DELETE FROM public.user_profiles 
WHERE email LIKE '%test%' 
   OR email LIKE '%fake%'
   OR email LIKE '%demo%'
   OR email LIKE '%example%'
   OR username LIKE '%test%'
   OR username LIKE '%fake%'
   OR username LIKE '%demo%';

-- Clean up orphaned data
DELETE FROM public.coin_transactions_log WHERE user_id NOT IN (SELECT id FROM public.user_profiles);
DELETE FROM public.wheel_spins WHERE user_id NOT IN (SELECT id FROM public.user_profiles);
DELETE FROM public.user_insurances WHERE user_id NOT IN (SELECT id FROM public.user_profiles);
DELETE FROM public.live_streams WHERE broadcaster_id NOT IN (SELECT id FROM public.user_profiles);
DELETE FROM public.troll_family_members WHERE user_id NOT IN (SELECT id FROM public.user_profiles);
DELETE FROM public.family_applications WHERE applicant_id NOT IN (SELECT id FROM public.user_profiles);

-- Reset testing mode and counters
UPDATE public.app_settings 
SET value = jsonb_set(value, '{enabled}', 'false'::jsonb)
WHERE key = 'testing_mode';

UPDATE public.app_settings 
SET value = jsonb_set(value, '{current_signups}', '0'::jsonb)
WHERE key = 'testing_mode';

-- Log cleanup
INSERT INTO public.system_logs (event_type, description, metadata, created_at)
VALUES (
  'production_cleanup',
  'Deleted all test accounts and reset testing mode for production deployment',
  jsonb_build_object(
    'timestamp', NOW(),
    'action', 'delete_test_accounts'
  ),
  NOW()
);
