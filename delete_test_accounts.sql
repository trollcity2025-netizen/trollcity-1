-- ============================================================================
-- DELETE TEST ACCOUNTS
-- ============================================================================
-- This script deletes test user accounts with usernames starting with 'user'
-- from both public.user_profiles and auth.users tables
-- ============================================================================

-- First, let's see what test accounts exist
SELECT 'PREVIEW: Test accounts to be deleted' as info;
SELECT id, username, email, created_at 
FROM public.user_profiles 
WHERE username LIKE 'user%'
ORDER BY created_at;

-- Count test accounts
SELECT 
    'Found ' || COUNT(*) || ' test account(s) with username starting with "user"' as count_message
FROM public.user_profiles 
WHERE username LIKE 'user%';

-- ============================================================================
-- DELETION SECTION - Uncomment the lines below to execute deletion
-- ============================================================================

-- BEGIN;

-- -- Create temp table with test user IDs
-- CREATE TEMP TABLE test_user_ids AS
-- SELECT id FROM public.user_profiles WHERE username LIKE 'user%';

-- -- Delete from user_profiles (cascades to related tables via FK constraints)
-- DELETE FROM public.user_profiles 
-- WHERE username LIKE 'user%';

-- -- Delete from auth.users
-- DELETE FROM auth.users 
-- WHERE id IN (SELECT id FROM test_user_ids);

-- -- Clean up temp table
-- DROP TABLE test_user_ids;

-- COMMIT;

-- -- Verification
-- SELECT 
--     'Remaining users in user_profiles: ' || COUNT(*) as remaining_count 
-- FROM public.user_profiles;

-- ============================================================================
-- INSTRUCTIONS:
-- 1. Run the PREVIEW section first to see what will be deleted
-- 2. If satisfied, uncomment the DELETION SECTION (remove -- from each line)
-- 3. Run the entire script again to delete the test accounts
-- ============================================================================
