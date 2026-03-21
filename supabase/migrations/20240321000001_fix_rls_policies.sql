-- ============================================================================
-- Fix RLS Policy Always True Issues - Safe Version
-- Supabase Database Linter: rls_policy_always_true
-- 
-- This version checks if tables exist before modifying policies
-- ============================================================================

-- Function to safely drop and recreate policy if table exists
CREATE OR REPLACE FUNCTION _fix_rls_if_table_exists(
    p_table_name TEXT,
    p_policy_name TEXT,
    p_policy_sql TEXT
) RETURNS void AS $$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = p_table_name) THEN
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_policy_name, p_table_name);
        EXECUTE p_policy_sql;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- admin_actions_log - System insert logs (service role only)
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'admin_actions_log',
    'System insert logs',
    'CREATE POLICY "System insert logs" ON public.admin_actions_log
        FOR INSERT WITH CHECK (
            current_setting(''app.service_role_key'', true) IS NOT NULL
        )'
);

-- ============================================================================
-- admin_audit_logs - Check if admins table exists first
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admins') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs';
        EXECUTE 'CREATE POLICY "Admins can insert audit logs" ON public.admin_audit_logs
            FOR INSERT WITH CHECK (current_setting(''app.service_role_key'', true) IS NOT NULL)';
    ELSE
        EXECUTE 'DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs';
        EXECUTE 'CREATE POLICY "Admins can insert audit logs" ON public.admin_audit_logs
            FOR INSERT WITH CHECK (current_setting(''app.service_role_key'', true) IS NOT NULL)';
    END IF;
END $$;

-- ============================================================================
-- allowed_devices
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'allowed_devices',
    'allowed devices insert',
    'CREATE POLICY "allowed devices insert" ON public.allowed_devices
        FOR INSERT WITH CHECK (
            auth.uid() = user_id
            OR current_setting(''app.service_role_key'', true) IS NOT NULL
        )'
);

-- ============================================================================
-- apns_tokens - Service role only
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'apns_tokens',
    'Service role can manage all APNS tokens',
    'CREATE POLICY "Service role can manage all APNS tokens" ON public.apns_tokens
        FOR ALL USING (current_setting(''app.service_role_key'', true) IS NOT NULL)
        WITH CHECK (current_setting(''app.service_role_key'', true) IS NOT NULL)'
);

-- ============================================================================
-- device_block_logs
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'device_block_logs',
    'device logs insert',
    'CREATE POLICY "device logs insert" ON public.device_block_logs
        FOR INSERT WITH CHECK (
            current_setting(''app.service_role_key'', true) IS NOT NULL
        )'
);

-- ============================================================================
-- family_activity_log
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'family_activity_log',
    'System can insert activity log',
    'CREATE POLICY "System can insert activity log" ON public.family_activity_log
        FOR INSERT WITH CHECK (
            current_setting(''app.service_role_key'', true) IS NOT NULL
            OR EXISTS (SELECT 1 FROM public.family_members WHERE user_id = auth.uid())
        )'
);

-- ============================================================================
-- family_war_scores
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'family_war_scores',
    'Service role full access',
    'CREATE POLICY "Service role full access" ON public.family_war_scores
        FOR ALL USING (current_setting(''app.service_role_key'', true) IS NOT NULL)
        WITH CHECK (current_setting(''app.service_role_key'', true) IS NOT NULL)'
);

-- ============================================================================
-- fcm_tokens
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'fcm_tokens',
    'Service role can manage all FCM tokens',
    'CREATE POLICY "Service role can manage all FCM tokens" ON public.fcm_tokens
        FOR ALL USING (current_setting(''app.service_role_key'', true) IS NOT NULL)
        WITH CHECK (current_setting(''app.service_role_key'', true) IS NOT NULL)'
);

-- ============================================================================
-- global_events
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'global_events',
    'Allow authenticated users to insert events',
    'CREATE POLICY "Allow authenticated users to insert events" ON public.global_events
        FOR INSERT WITH CHECK (
            auth.uid() IS NOT NULL
            AND content IS NOT NULL
            AND content != ''''
        )'
);

-- ============================================================================
-- guest_tracking_logs
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'guest_tracking_logs',
    'Service role can insert guest logs',
    'CREATE POLICY "Service role can insert guest logs" ON public.guest_tracking_logs
        FOR INSERT WITH CHECK (
            current_setting(''app.service_role_key'', true) IS NOT NULL
        )'
);

-- ============================================================================
-- live_viewers
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'live_viewers',
    'live viewers insert',
    'CREATE POLICY "live viewers insert" ON public.live_viewers
        FOR INSERT WITH CHECK (
            auth.uid() = user_id
            OR current_setting(''app.service_role_key'', true) IS NOT NULL
        )'
);

-- ============================================================================
-- mobile_error_logs
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'mobile_error_logs',
    'Anyone can insert error logs',
    'CREATE POLICY "Anyone can insert error logs" ON public.mobile_error_logs
        FOR INSERT WITH CHECK (
            LENGTH(COALESCE(error_message, '''')) < 10000
        )'
);

-- ============================================================================
-- mobile_errors
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'mobile_errors',
    'Allow anyone to insert mobile errors',
    'CREATE POLICY "Allow anyone to insert mobile errors" ON public.mobile_errors
        FOR INSERT WITH CHECK (
            LENGTH(COALESCE(error_message, '''')) < 10000
        )'
);

-- ============================================================================
-- officer_votes
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'officers') THEN
        EXECUTE 'DROP POLICY IF EXISTS "votes insert" ON public.officer_votes';
        EXECUTE 'CREATE POLICY "votes insert" ON public.officer_votes
            FOR INSERT WITH CHECK (
                auth.uid() IN (SELECT user_id FROM public.officers)
                OR current_setting(''app.service_role_key'', true) IS NOT NULL
            )';
    ELSE
        EXECUTE 'DROP POLICY IF EXISTS "votes insert" ON public.officer_votes';
        EXECUTE 'CREATE POLICY "votes insert" ON public.officer_votes
            FOR INSERT WITH CHECK (
                current_setting(''app.service_role_key'', true) IS NOT NULL
            )';
    END IF;
END $$;

-- ============================================================================
-- officer_work_sessions
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'officers') THEN
        EXECUTE 'DROP POLICY IF EXISTS "officer sessions full" ON public.officer_work_sessions';
        EXECUTE 'CREATE POLICY "officer sessions full" ON public.officer_work_sessions
            FOR ALL USING (
                auth.uid() IN (SELECT user_id FROM public.officers)
                OR current_setting(''app.service_role_key'', true) IS NOT NULL
            )
            WITH CHECK (
                auth.uid() IN (SELECT user_id FROM public.officers)
                OR current_setting(''app.service_role_key'', true) IS NOT NULL
            )';
    ELSE
        EXECUTE 'DROP POLICY IF EXISTS "officer sessions full" ON public.officer_work_sessions';
        EXECUTE 'CREATE POLICY "officer sessions full" ON public.officer_work_sessions
            FOR ALL USING (current_setting(''app.service_role_key'', true) IS NOT NULL)
            WITH CHECK (current_setting(''app.service_role_key'', true) IS NOT NULL)';
    END IF;
END $$;

-- ============================================================================
-- onesignal_tokens
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'onesignal_tokens',
    'Service role can manage all OneSignal tokens',
    'CREATE POLICY "Service role can manage all OneSignal tokens" ON public.onesignal_tokens
        FOR ALL USING (current_setting(''app.service_role_key'', true) IS NOT NULL)
        WITH CHECK (current_setting(''app.service_role_key'', true) IS NOT NULL)'
);

-- ============================================================================
-- server_error_events
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'server_error_events',
    'Anyone can insert server errors',
    'CREATE POLICY "Anyone can insert server errors" ON public.server_error_events
        FOR INSERT WITH CHECK (
            auth.uid() IS NOT NULL
        )'
);

-- ============================================================================
-- signup_queue
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'signup_queue',
    'Anyone can join the queue',
    'CREATE POLICY "Anyone can join the queue" ON public.signup_queue
        FOR INSERT WITH CHECK (TRUE)'
);

-- ============================================================================
-- stream_audio_monitoring
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_members') THEN
        EXECUTE 'DROP POLICY IF EXISTS "System can manage monitoring" ON public.stream_audio_monitoring';
        EXECUTE 'CREATE POLICY "System can manage monitoring" ON public.stream_audio_monitoring
            FOR ALL USING (
                auth.uid() IN (SELECT user_id FROM public.staff_members)
                OR current_setting(''app.service_role_key'', true) IS NOT NULL
            )
            WITH CHECK (
                auth.uid() IN (SELECT user_id FROM public.staff_members)
                OR current_setting(''app.service_role_key'', true) IS NOT NULL
            )';
    ELSE
        EXECUTE 'DROP POLICY IF EXISTS "System can manage monitoring" ON public.stream_audio_monitoring';
        EXECUTE 'CREATE POLICY "System can manage monitoring" ON public.stream_audio_monitoring
            FOR ALL USING (current_setting(''app.service_role_key'', true) IS NOT NULL)
            WITH CHECK (current_setting(''app.service_role_key'', true) IS NOT NULL)';
    END IF;
END $$;

-- ============================================================================
-- system_errors
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'system_errors',
    'Anon users can insert errors',
    'CREATE POLICY "Anon users can insert errors" ON public.system_errors
        FOR INSERT WITH CHECK (
            LENGTH(COALESCE(error_message, '''')) < 5000
        )'
);

SELECT _fix_rls_if_table_exists(
    'system_errors',
    'Authenticated users can insert errors',
    'CREATE POLICY "Authenticated users can insert errors" ON public.system_errors
        FOR INSERT WITH CHECK (
            LENGTH(COALESCE(error_message, '''')) < 5000
        )'
);

-- ============================================================================
-- tcnn_articles
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admins') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tcnn_editors') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Allow all inserts" ON public.tcnn_articles';
        EXECUTE 'CREATE POLICY "Allow all inserts" ON public.tcnn_articles
            FOR INSERT WITH CHECK (
                current_setting(''app.service_role_key'', true) IS NOT NULL
                OR auth.uid() IN (SELECT user_id FROM public.admins)
                OR auth.uid() IN (SELECT user_id FROM public.tcnn_editors)
            )';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admins') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Allow all inserts" ON public.tcnn_articles';
        EXECUTE 'CREATE POLICY "Allow all inserts" ON public.tcnn_articles
            FOR INSERT WITH CHECK (
                current_setting(''app.service_role_key'', true) IS NOT NULL
                OR auth.uid() IN (SELECT user_id FROM public.admins)
            )';
    ELSE
        EXECUTE 'DROP POLICY IF EXISTS "Allow all inserts" ON public.tcnn_articles';
        EXECUTE 'CREATE POLICY "Allow all inserts" ON public.tcnn_articles
            FOR INSERT WITH CHECK (
                current_setting(''app.service_role_key'', true) IS NOT NULL
            )';
    END IF;
END $$;

-- ============================================================================
-- troll_battles
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'troll_battles',
    'System update battles',
    'CREATE POLICY "System update battles" ON public.troll_battles
        FOR ALL USING (current_setting(''app.service_role_key'', true) IS NOT NULL)
        WITH CHECK (current_setting(''app.service_role_key'', true) IS NOT NULL)'
);

-- ============================================================================
-- user_ip_locations
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'user_ip_locations',
    'System can insert locations',
    'CREATE POLICY "System can insert locations" ON public.user_ip_locations
        FOR INSERT WITH CHECK (
            auth.uid() = user_id
            OR current_setting(''app.service_role_key'', true) IS NOT NULL
        )'
);

-- ============================================================================
-- user_reports
-- ============================================================================
SELECT _fix_rls_if_table_exists(
    'user_reports',
    'Anyone can create reports',
    'CREATE POLICY "Anyone can create reports" ON public.user_reports
        FOR INSERT WITH CHECK (
            auth.uid() IS NOT NULL
            AND reporter_id = auth.uid()
        )'
);

-- Cleanup helper function
DROP FUNCTION IF EXISTS _fix_rls_if_table_exists;

-- Success message
SELECT 'RLS policy fixes applied successfully!' AS status;
