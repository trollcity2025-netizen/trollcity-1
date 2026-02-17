-- Fix register_session function to handle unique constraint on user_id
-- The active_sessions table has a unique constraint on user_id,
-- so we need to use ON CONFLICT (user_id) instead of ON CONFLICT (session_id)

CREATE OR REPLACE FUNCTION "public"."register_session"("p_user_id" "uuid", "p_session_id" "uuid", "p_device_info" "jsonb" DEFAULT '{}'::"jsonb", "p_ip_address" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Deactivate any existing sessions for this user (single device policy)
    UPDATE active_sessions
    SET is_active = FALSE, last_active = NOW()
    WHERE user_id = p_user_id AND is_active = TRUE;
    
    -- Insert new session - use ON CONFLICT (user_id) since there's a unique constraint on user_id
    INSERT INTO active_sessions (user_id, session_id, device_info, ip_address, user_agent)
    VALUES (p_user_id, p_session_id, p_device_info, p_ip_address, p_user_agent)
    ON CONFLICT (user_id) DO UPDATE
    SET is_active = TRUE, last_active = NOW(), device_info = p_device_info, 
        ip_address = p_ip_address, user_agent = p_user_agent, session_id = p_session_id;
END;
$$;

COMMENT ON FUNCTION "public"."register_session"("p_user_id" "uuid", "p_session_id" "uuid", "p_device_info" "jsonb", "p_ip_address" "text", "p_user_agent" "text") IS 'Register a new user session and deactivate previous ones';
