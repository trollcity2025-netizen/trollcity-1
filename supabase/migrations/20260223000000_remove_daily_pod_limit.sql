-- Migration: Remove Daily Pod Limit
-- Description: Removes the daily pod limit check from can_start_pod function.
--              The LMPM (Low Minute Protection Mode) still enforces:
--              - 1 simultaneous pod globally
--              - 30-minute max duration until March 1st 2026

-- Update can_start_pod to remove daily pod limit
CREATE OR REPLACE FUNCTION public.can_start_pod(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_lmpm_enabled BOOLEAN;
    v_active_pods_count INT;
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
        -- Rule: 1 simultaneous pod globally (keep this limit)
        SELECT count(*) INTO v_active_pods_count 
        FROM public.pod_rooms 
        WHERE is_live = true;

        IF v_active_pods_count >= 1 THEN
            RETURN jsonb_build_object('can_start', false, 'message', 'The Town Square is full. Only one Pod at a time.');
        END IF;

        -- Daily pod limit REMOVED - users can now start unlimited pods per day
    END IF;

    RETURN jsonb_build_object('can_start', true);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.can_start_pod(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_start_pod(UUID) TO service_role;
