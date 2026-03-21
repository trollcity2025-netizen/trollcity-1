# Database Linter Fixes Summary

## Overview

This document summarizes the Supabase database linting issues and their fixes.

## Issues Identified

### 1. function_search_path_mutable (Security)
**Severity:** WARN  
**Count:** ~300+ functions  
**Description:** Detects functions where the search_path parameter is not set, which can lead to potential privilege escalation attacks.

**Fix:** [`fix_all_search_paths.sql`](fix_all_search_paths.sql)
- Adds `SET search_path = ''` to all affected functions
- Creates a helper function to fix functions dynamically
- Manually fixes critical system functions

### 2. extension_in_public (Security)
**Severity:** WARN  
**Description:** Extension `postgis` is installed in the public schema.

**Fix:** [`fix_extension_and_materialized_view.sql`](fix_extension_and_materialized_view.sql)
- Moves postgis extension from public to extensions schema
- Also moves uuid-ossp and pgcrypto to extensions schema
- Creates documentation view for extension status
- Works with Supabase Pro plan

### 3. materialized_view_in_api (Security)
**Severity:** WARN  
**Description:** Materialized view `public.user_earnings_summary` is selectable by anon or authenticated roles.

**Fix:** [`fix_extension_and_materialized_view.sql`](fix_extension_and_materialized_view.sql)
- Revokes SELECT access from anon/authenticated roles
- Grants SELECT only to service_role
- Optionally adds RLS policy for user-specific access

### 4. rls_policy_always_true (Security)
**Severity:** WARN  
**Count:** ~24 tables  
**Description:** RLS policies that use `WITH CHECK (true)` for INSERT, UPDATE, or DELETE operations.

**Tables Affected:**
- admin_actions_log
- admin_audit_logs
- allowed_devices
- apns_tokens
- device_block_logs
- family_activity_log
- family_war_scores
- fcm_tokens
- global_events
- guest_tracking_logs
- live_viewers
- mobile_error_logs
- mobile_errors
- officer_votes
- officer_work_sessions
- onesignal_tokens
- server_error_events
- signup_queue
- stream_audio_monitoring
- system_errors (2 policies)
- tcnn_articles
- troll_battles
- user_ip_locations
- user_reports

**Fix:** [`fix_rls_policies.sql`](fix_rls_policies.sql)
- Replaces overly permissive policies with proper security checks
- Uses auth.uid() validation
- Checks for service_role key
- Validates input data

## How to Apply Fixes

### Order of Execution

1. **First:** Apply RLS policy fixes
   ```bash
   psql -h your-db-host -U postgres -d postgres -f fix_rls_policies.sql
   ```

2. **Second:** Apply extension and materialized view fixes
   ```bash
   psql -h your-db-host -U postgres -d postgres -f fix_extension_and_materialized_view.sql
   ```

3. **Third:** Apply function search_path fixes
   ```bash
   psql -h your-db-host -U postgres -d postgres -f fix_all_search_paths.sql
   ```

### Via Supabase Dashboard

1. Go to the SQL Editor in Supabase
2. Copy and paste each file's contents
3. Run the SQL

## Testing

After applying fixes, run the Supabase database linter again to verify:

```sql
-- Check function search_path status
SELECT proname, prosrc LIKE '%search_path%' AS has_search_path
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY proname;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check materialized view access
SELECT 
    table_name,
    privilege_type,
    grantee
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'user_earnings_summary';
```

## Notes

- The `extension_in_public` issue requires Supabase Pro or higher to fully resolve
- Always backup your database before running migration scripts
- Test these fixes in a staging environment first
- Some policies may need adjustment based on your specific requirements

## Performance Considerations

The fixes do not introduce any performance issues:
- RLS policies are optimized with proper USING clauses
- search_path setting has minimal overhead
- Materialized view access is restricted, not modified

## Security Impact

These fixes improve security by:
1. Preventing function privilege escalation
2. Restricting API access to sensitive data
3. Adding proper validation to RLS policies
4. Reducing attack surface for data exfiltration
