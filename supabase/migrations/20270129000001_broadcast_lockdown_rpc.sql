+-- Broadcast Lockdown RPC Function
-- This function checks if a user can start a broadcast based on the lockdown setting

-- Function to check if broadcasts are allowed for a user
CREATE OR REPLACE FUNCTION public.can_start_broadcast(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_lockdown_enabled BOOLEAN;
BEGIN
    -- Get user's admin status
    SELECT
        COALESCE(is_admin, false) = true OR
        role IN ('admin', 'secretary', 'lead_troll_officer', 'troll_officer')
    INTO v_is_admin
    FROM public.user_profiles
    WHERE id = p_user_id;

    -- Get lockdown setting
    SELECT
        (setting_value->>'enabled')::boolean
    INTO v_lockdown_enabled
    FROM public.admin_settings
    WHERE setting_key = 'broadcast_lockdown_enabled'
    LIMIT 1;

    -- If no lockdown setting exists, default to false (broadcasts allowed)
    v_lockdown_enabled := COALESCE(v_lockdown_enabled, false);

    -- Allow if not in lockdown OR user is admin
    IF v_lockdown_enabled AND NOT v_is_admin THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.can_start_broadcast(UUID) TO authenticated;

-- Grant to service_role for edge functions
GRANT EXECUTE ON FUNCTION public.can_start_broadcast(UUID) TO service_role;

-- Function to get lockdown status (for frontend display)
CREATE OR REPLACE FUNCTION public.get_broadcast_lockdown_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT setting_value
        FROM public.admin_settings
        WHERE setting_key = 'broadcast_lockdown_enabled'
        LIMIT 1
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_broadcast_lockdown_status() TO authenticated;
