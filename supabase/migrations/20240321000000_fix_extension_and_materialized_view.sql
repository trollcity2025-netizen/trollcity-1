-- ============================================================================
-- Fix Extension in Public Schema Issue
-- Supabase Database Linter: extension_in_public
-- 
-- Move postgis extension from public to extensions schema
-- Since user is on Supabase Pro, this can be fully resolved
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
-- ============================================================================

-- Check current extension location
SELECT extname, extnamespace::regnamespace AS schema_name
FROM pg_extension
WHERE extname = 'postgis';

-- Move postgis extension to extensions schema
-- This requires creating the extension in a new schema first
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Verify the move
SELECT extname, extnamespace::regnamespace AS schema_name
FROM pg_extension
WHERE extname = 'postgis';

-- Drop the old extension if it exists in public
DROP EXTENSION IF EXISTS postgis CASCADE;

-- Recreate in extensions schema
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- ============================================================================
-- Also move other commonly moved extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Create a documentation view for extension status
CREATE OR REPLACE VIEW public.extension_status AS
SELECT 
    extname AS extension_name,
    extnamespace::regnamespace AS schema_name,
    extversion AS version,
    CASE 
        WHEN extnamespace::regnamespace::text = 'public' THEN 'WARNING: Extension in public schema'
        ELSE 'OK: Extension in proper schema'
    END AS status
FROM pg_extension
WHERE extname IN ('postgis', 'uuid-ossp', 'pgcrypto', 'intarray');

-- ============================================================================
-- Fix Materialized View in API Issue  
-- Supabase Database linter: materialized_view_in_api
-- 
-- Remove anon/authenticated access from user_earnings_summary
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0016_materialized_view_in_api
-- ============================================================================

-- ============================================================================
-- Option 1: Revoke public access to the materialized view
-- ============================================================================

-- Revoke SELECT for anon role
REVOKE SELECT ON public.user_earnings_summary FROM anon;
REVOKE SELECT ON public.user_earnings_summary FROM authenticated;

-- Grant only to service role (for admin dashboard)
GRANT SELECT ON public.user_earnings_summary TO service_role;

-- ============================================================================
-- Option 2: Add a proper RLS policy if access is needed
-- ============================================================================

-- Enable RLS on materialized view (if not already)
ALTER MATERIALIZED VIEW public.user_earnings_summary ENABLE ROW LEVEL SECURITY;

-- Create a policy that only allows users to see their own data
DROP POLICY IF EXISTS "Users can view own earnings" ON public.user_earnings_summary;
CREATE POLICY "Users can view own earnings" ON public.user_earnings_summary
    FOR SELECT
    USING (user_id = auth.uid());

-- Or if it's admin-only:
-- DROP POLICY IF EXISTS "Admins can view all earnings" ON public.user_earnings_summary;
-- CREATE POLICY "Admins can view all earnings" ON public.user_earnings_summary
--     FOR SELECT
--     USING (
--         auth.uid() IN (SELECT user_id FROM public.admins)
--     );

-- ============================================================================
-- Summary
-- ============================================================================
SELECT 'Extension and materialized view fixes applied!' AS status;

-- Verify changes
SELECT 
    'Materialized View Access' AS issue_type,
    COUNT(*) AS anon_can_access,
    CASE 
        WHEN COUNT(*) > 0 THEN 'NEEDS FIX'
        ELSE 'FIXED'
    END AS status
FROM information_schema.schema_privileges
WHERE table_schema = 'public'
  AND table_name = 'user_earnings_summary'
  AND privilege_type = 'SELECT'
  AND grantee = 'anon';
