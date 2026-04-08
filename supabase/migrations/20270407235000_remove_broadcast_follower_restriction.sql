-- Remove 1 follower restriction for all broadcasts, keep gaming at 100 followers
-- Update can_start_broadcast to remove badge requirement (everyone can broadcast)
CREATE OR REPLACE FUNCTION public.can_start_broadcast(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_lockdown_enabled BOOLEAN;
    v_is_locked BOOLEAN;
    v_lmpm_enabled BOOLEAN;
    v_active_streams_count INT;
    v_daily_broadcast_count INT;
BEGIN
    -- Get user info
    SELECT
        (COALESCE(is_admin, false) = true OR role IN ('admin', 'secretary', 'lead_troll_officer', 'troll_officer')),
        COALESCE(is_broadcast_locked, false)
    INTO v_is_admin, v_is_locked
    FROM public.user_profiles
    WHERE id = p_user_id;

    -- 1. Immediate Lock Check
    IF v_is_locked THEN
        RETURN jsonb_build_object('can_start', false, 'message', 'Your broadcasting permit has been suspended.');
    END IF;

    -- 2. Global Lockdown Check
    SELECT (setting_value::jsonb->>'enabled')::boolean
    INTO v_lockdown_enabled
    FROM public.admin_app_settings
    WHERE setting_key = 'broadcast_lockdown_enabled'
    LIMIT 1;

    IF COALESCE(v_lockdown_enabled, false) AND NOT v_is_admin THEN
        RETURN jsonb_build_object('can_start', false, 'message', 'City bandwidth exhausted for today.');
    END IF;

    -- 3. Low-Minute Protection Mode Checks
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

    -- All users can broadcast normally with no restrictions
    RETURN jsonb_build_object('can_start', true);
END;
$$;

-- Update Trollmers/gaming eligibility to 100 followers
CREATE OR REPLACE FUNCTION public.is_trollmers_eligible(
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_followers_count INTEGER;
    v_user_role TEXT;
BEGIN
    -- Check if user is admin (bypass follower requirement)
    SELECT role INTO v_user_role
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF v_user_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Check follower count for non-admins - 10 followers required
    SELECT COUNT(*)
    INTO v_followers_count
    FROM public.user_follows
    WHERE following_id = p_user_id;

    RETURN v_followers_count >= 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_start_broadcast(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_start_broadcast(UUID) TO service_role;
