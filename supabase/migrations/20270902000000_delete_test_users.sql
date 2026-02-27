-- Delete all test users with username starting with 'user' from both auth.users and user_profiles
-- This is a comprehensive cleanup of test accounts

BEGIN;

-- First, get the list of user IDs to delete from user_profiles
CREATE TEMP TABLE test_user_ids AS
SELECT id FROM public.user_profiles WHERE username LIKE 'user%';

-- Count how many we'll delete
SELECT 'Deleting ' || COUNT(*) || ' test users' as count FROM test_user_ids;

-- Delete from user_profiles (this may cascade to other tables with FK constraints)
DELETE FROM public.user_profiles WHERE username LIKE 'user%';

-- Delete from auth.users (this is the Supabase auth table)
-- Only delete if the user still exists in auth.users
DELETE FROM auth.users 
WHERE id IN (SELECT id FROM test_user_ids);

-- Clean up temp table
DROP TABLE test_user_ids;

-- Verify remaining users
SELECT 'Remaining users in user_profiles: ' || COUNT(*) as remaining_count FROM public.user_profiles;

COMMIT;
