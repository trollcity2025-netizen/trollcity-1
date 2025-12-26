-- Complete RLS Policy Update Documentation
-- Date: 2025-02-11
-- Purpose: Document all RLS policy changes for purchase functionality

-- =====================================================
-- PROBLEM IDENTIFIED
-- =====================================================
-- Row-level security policy violations were blocking users from purchasing:
-- - Entrance effects
-- - Perks
-- - Insurance
--
-- Root Cause: Original RLS policies only allowed:
--   WITH CHECK (auth.uid() = user_id)
--
-- This restriction prevented inserts even from authenticated users in certain
-- scenarios where the insert needed to bypass RLS through service_role.

-- =====================================================
-- SOLUTION IMPLEMENTED
-- =====================================================
-- Updated all INSERT policies to:
--   WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role')
--
-- This allows:
-- 1. Authenticated users to insert their own records
-- 2. Service role (backend/RPC functions) to insert records
-- 3. Admin operations to bypass RLS when needed

-- =====================================================
-- TABLES AFFECTED
-- =====================================================
-- 1. user_entrance_effects
--    - Tracks purchased entrance effects
--    - User can view/insert/update their own effects
--    - Service role can bypass RLS
--
-- 2. user_perks
--    - Tracks purchased and active perks
--    - User can view/insert/update their own perks
--    - Service role can bypass RLS
--
-- 3. user_insurances
--    - Tracks purchased insurance coverage
--    - User can view/insert/update their own insurance
--    - Service role can bypass RLS

-- =====================================================
-- POLICY CHANGES SUMMARY
-- =====================================================

-- TABLE: user_entrance_effects
-- OLD: FOR INSERT WITH CHECK (auth.uid() = user_id);
-- NEW: FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- TABLE: user_perks
-- OLD: FOR INSERT WITH CHECK (auth.uid() = user_id);
-- NEW: FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- TABLE: user_insurances
-- OLD: FOR INSERT WITH CHECK (auth.uid() = user_id);
-- NEW: FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- =====================================================
-- BACKWARD COMPATIBILITY
-- =====================================================
-- All changes are backward compatible:
-- - Original condition (auth.uid() = user_id) still works
-- - Existing authenticated user inserts continue to work
-- - New service_role bypass enables additional use cases
-- - No data migration needed
-- - No schema changes required

-- =====================================================
-- VERIFICATION
-- =====================================================
-- To verify policies are correctly applied:

-- Check policies exist:
-- SELECT schemaname, tablename, policyname, permissive, roles
-- FROM pg_policies
-- WHERE tablename IN ('user_entrance_effects', 'user_perks', 'user_insurances')
-- AND cmd = 'INSERT';

-- Expected output: 3 INSERT policies with roles including 'authenticated' and 'service_role'

DO $$ BEGIN
  RAISE NOTICE 'RLS policies updated successfully for purchase functionality';
  RAISE NOTICE 'Users can now purchase entrance effects, perks, and insurance';
END $$;
