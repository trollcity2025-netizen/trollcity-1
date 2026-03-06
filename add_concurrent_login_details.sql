-- Enhanced check_concurrent_login function that returns detailed information about the original session
CREATE OR REPLACE FUNCTION "public"."check_concurrent_login"("p_user_id" "uuid", "p_current_session_id" "uuid") 
RETURNS TABLE (
    has_concurrent_login BOOLEAN,
    original_session_id UUID,
    original_device_info TEXT,
    original_last_active TIMESTAMPTZ
)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
    original_session RECORD;
BEGIN
    -- Find the oldest active session for this user (excluding current session)
    SELECT 
        session_id,
        device_info,
        last_active INTO original_session
    FROM active_sessions
    WHERE user_id = p_user_id
      AND session_id != p_current_session_id
      AND is_active = TRUE
      AND created_at > NOW() - INTERVAL '30 minutes'
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Return detailed information
    IF original_session.session_id IS NOT NULL THEN
        RETURN QUERY SELECT 
            TRUE,
            original_session.session_id,
            original_session.device_info,
            original_session.last_active;
    ELSE
        RETURN QUERY SELECT 
            FALSE,
            NULL::UUID,
            NULL::TEXT,
            NULL::TIMESTAMPTZ;
    END IF;
END;
$$;

ALTER FUNCTION "public"."check_concurrent_login"("p_user_id" "uuid", "p_current_session_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."check_concurrent_login"("p_user_id" "uuid", "p_current_session_id" "uuid") 
IS 'Check if user has active sessions on other devices and return details about the original session';
