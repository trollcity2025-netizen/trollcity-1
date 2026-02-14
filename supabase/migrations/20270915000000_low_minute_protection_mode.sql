-- Migration: Low-Minute Protection Mode (LMPM) - Fix & Alignment
-- Description: Corrects admin_settings column names and enforces strict limits on broadcasts.

-- 1. Create or Update admin_app_settings for LMPM flag (Using actual schema: setting_key, setting_value)
INSERT INTO public.admin_app_settings (setting_key, setting_value, description)
VALUES (
    'low_minute_protection_mode', 
    '{"enabled": true}', 
    'When enabled, limits to 1 broadcast per day, 30 min max, 1 simultaneous stream.'
)
ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 2. Update can_start_broadcast RPC with LMPM logic
CREATE OR REPLACE FUNCTION public.can_start_broadcast(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_lockdown_enabled BOOLEAN;
    v_is_locked BOOLEAN;
    v_has_badge BOOLEAN;
    v_lmpm_enabled BOOLEAN;
    v_active_streams_count INT;
    v_daily_broadcast_count INT;
BEGIN
    -- Get user info
    SELECT
        (COALESCE(is_admin, false) = true OR role IN ('admin', 'secretary', 'lead_troll_officer', 'troll_officer')),
        COALESCE(is_broadcast_locked, false),
        COALESCE(has_broadcast_badge, false)
    INTO v_is_admin, v_is_locked, v_has_badge
    FROM public.user_profiles
    WHERE id = p_user_id;

    -- 1. Immediate Lock Check
    IF v_is_locked THEN
        RETURN jsonb_build_object('can_start', false, 'message', 'Your broadcasting permit has been suspended.');
    END IF;

    -- 2. Global Lockdown Check (Using admin_app_settings)
    SELECT (setting_value::jsonb->>'enabled')::boolean
    INTO v_lockdown_enabled
    FROM public.admin_app_settings
    WHERE setting_key = 'broadcast_lockdown_enabled'
    LIMIT 1;

    IF COALESCE(v_lockdown_enabled, false) AND NOT v_is_admin THEN
        RETURN jsonb_build_object('can_start', false, 'message', 'City bandwidth exhausted for today.');
    END IF;

    -- 3. Low-Minute Protection Mode (LMPM) Checks
    SELECT (setting_value::jsonb->>'enabled')::boolean
    INTO v_lmpm_enabled
    FROM public.admin_app_settings
    WHERE setting_key = 'low_minute_protection_mode'
    LIMIT 1;

    IF COALESCE(v_lmpm_enabled, false) THEN
        -- Rule: 1 simultaneous stream globally
        SELECT count(*) INTO v_active_streams_count 
        FROM public.streams 
        WHERE status = 'active' OR is_live = true;

        IF v_active_streams_count >= 1 THEN
            RETURN jsonb_build_object('can_start', false, 'message', 'Arena capacity reached. Another session is in progress.');
        END IF;

        -- Rule: 1 broadcast per calendar day (UTC Safe)
        SELECT count(*) INTO v_daily_broadcast_count
        FROM public.streams
        WHERE created_at >= ((NOW() AT TIME ZONE 'utc')::date)
        AND (status IN ('active', 'completed', 'ended'));

        IF v_daily_broadcast_count >= 1 THEN
            RETURN jsonb_build_object('can_start', false, 'message', 'Daily broadcast limit reached. Next session tomorrow.');
        END IF;
    END IF;

    -- 4. Badge Check
    IF NOT v_has_badge AND NOT v_is_admin THEN
        RETURN jsonb_build_object('can_start', false, 'message', 'You do not have a valid broadcasting permit.');
    END IF;

    RETURN jsonb_build_object('can_start', true);
END;
$$;

-- 3. Add enforce_lmpm_durations RPC for auto-ending streams
CREATE OR REPLACE FUNCTION public.enforce_lmpm_durations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lmpm_enabled BOOLEAN;
    v_stream_id UUID;
    v_ended_count INT := 0;
BEGIN
    -- Check if LMPM is enabled
    SELECT (setting_value::jsonb->>'enabled')::boolean
    INTO v_lmpm_enabled
    FROM public.admin_app_settings
    WHERE setting_key = 'low_minute_protection_mode'
    LIMIT 1;

    IF NOT COALESCE(v_lmpm_enabled, false) THEN
        RETURN jsonb_build_object('success', true, 'message', 'LMPM not enabled', 'ended_count', 0);
    END IF;

    -- Find streams active for more than 30 minutes
    -- Using started_at if available for more precision, falling back to created_at
    FOR v_stream_id IN 
        SELECT id 
        FROM public.streams 
        WHERE (status = 'active' OR is_live = true)
        AND COALESCE(started_at, created_at) < (NOW() - INTERVAL '30 minutes')
    LOOP
        -- End the stream in the database
        UPDATE public.streams 
        SET status = 'completed',
            is_live = false,
            ended_at = NOW()
        WHERE id = v_stream_id;

        v_ended_count := v_ended_count + 1;
        
        -- Log the termination (Using action_logs or admin_actions_log if preferred)
        -- Checking for admin_actions_log first
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_actions_log') THEN
            INSERT INTO public.admin_actions_log (admin_user_id, action_type, metadata, reason)
            VALUES (
                '00000000-0000-0000-0000-000000000000', -- System ID
                'lmpm_auto_end', 
                jsonb_build_object('stream_id', v_stream_id),
                '30 minute duration cap reached'
            );
        ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'action_logs') THEN
            INSERT INTO public.action_logs (action_type, metadata)
            VALUES ('lmpm_auto_end', jsonb_build_object('stream_id', v_stream_id, 'reason', '30 minute duration cap reached'));
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'ended_count', v_ended_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_lmpm_durations() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_lmpm_durations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_start_broadcast(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_start_broadcast(UUID) TO service_role;
