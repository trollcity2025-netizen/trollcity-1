-- Migration: Low-Minute Protection Mode (LMPM) for TrollPods
-- Description: Extends LMPM to TrollPods with 1 per day limit and 30-minute duration until March 1st 2026.

-- 1. Create can_start_pod RPC with LMPM logic
CREATE OR REPLACE FUNCTION public.can_start_pod(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_lmpm_enabled BOOLEAN;
    v_active_pods_count INT;
    v_daily_pod_count INT;
    v_is_before_deadline BOOLEAN;
BEGIN
    -- Deadline check: Rules apply until March 1st, 2026
    v_is_before_deadline := (NOW() AT TIME ZONE 'utc') < '2026-03-01'::timestamp;

    -- Get user info
    SELECT
        (COALESCE(is_admin, false) = true OR role IN ('admin', 'secretary', 'lead_troll_officer', 'troll_officer'))
    INTO v_is_admin
    FROM public.user_profiles
    WHERE id = p_user_id;

    -- Check if LMPM is enabled
    SELECT (setting_value::jsonb->>'enabled')::boolean
    INTO v_lmpm_enabled
    FROM public.admin_app_settings
    WHERE setting_key = 'low_minute_protection_mode'
    LIMIT 1;

    -- If LMPM is enabled AND we are before the March 1st deadline
    IF COALESCE(v_lmpm_enabled, false) AND v_is_before_deadline THEN
        -- Rule: 1 simultaneous pod globally
        SELECT count(*) INTO v_active_pods_count 
        FROM public.pod_rooms 
        WHERE is_live = true;

        IF v_active_pods_count >= 1 THEN
            RETURN jsonb_build_object('can_start', false, 'message', 'The Town Square is full. Only one Pod at a time.');
        END IF;

        -- Rule: 1 pod per calendar day (UTC Safe)
        SELECT count(*) INTO v_daily_pod_count
        FROM public.pod_rooms
        WHERE created_at >= ((NOW() AT TIME ZONE 'utc')::date)
        AND (is_live = true OR started_at >= ((NOW() AT TIME ZONE 'utc')::date));

        IF v_daily_pod_count >= 1 THEN
            RETURN jsonb_build_object('can_start', false, 'message', 'Daily Pod limit reached. The signal returns tomorrow.');
        END IF;
    END IF;

    RETURN jsonb_build_object('can_start', true);
END;
$$;

-- 2. Update enforce_lmpm_durations to also handle pod_rooms
CREATE OR REPLACE FUNCTION public.enforce_lmpm_durations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lmpm_enabled BOOLEAN;
    v_is_before_deadline BOOLEAN;
    v_stream_id UUID;
    v_pod_id UUID;
    v_ended_streams_count INT := 0;
    v_ended_pods_count INT := 0;
BEGIN
    -- Deadline check
    v_is_before_deadline := (NOW() AT TIME ZONE 'utc') < '2026-03-01'::timestamp;

    -- Check if LMPM is enabled
    SELECT (setting_value::jsonb->>'enabled')::boolean
    INTO v_lmpm_enabled
    FROM public.admin_app_settings
    WHERE setting_key = 'low_minute_protection_mode'
    LIMIT 1;

    IF NOT COALESCE(v_lmpm_enabled, false) THEN
        RETURN jsonb_build_object('success', true, 'message', 'LMPM not enabled', 'ended_count', 0);
    END IF;

    -- A. Handle Streams (Original logic)
    FOR v_stream_id IN 
        SELECT id 
        FROM public.streams 
        WHERE (status = 'active' OR is_live = true)
        AND COALESCE(started_at, created_at) < (NOW() - INTERVAL '30 minutes')
    LOOP
        UPDATE public.streams 
        SET status = 'completed', is_live = false, ended_at = NOW()
        WHERE id = v_stream_id;
        v_ended_streams_count := v_ended_streams_count + 1;
    END LOOP;

    -- B. Handle Pods (New logic, until March 1st 2026)
    IF v_is_before_deadline THEN
        FOR v_pod_id IN 
            SELECT id 
            FROM public.pod_rooms 
            WHERE is_live = true
            AND COALESCE(started_at, created_at) < (NOW() - INTERVAL '30 minutes')
        LOOP
            UPDATE public.pod_rooms 
            SET is_live = false,
                viewer_count = 0
            WHERE id = v_pod_id;
            
            -- Also clean up participants for this pod
            DELETE FROM public.pod_room_participants WHERE room_id = v_pod_id;
            
            v_ended_pods_count := v_ended_pods_count + 1;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'ended_streams', v_ended_streams_count,
        'ended_pods', v_ended_pods_count,
        'total_ended', v_ended_streams_count + v_ended_pods_count
    );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.can_start_pod(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_start_pod(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_lmpm_durations() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_lmpm_durations() TO authenticated;
