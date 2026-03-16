-- Fix for get_or_create_wheel_session function - fix ambiguous column reference

CREATE OR REPLACE FUNCTION public.get_or_create_wheel_session()
RETURNS TABLE(
  id UUID,
  user_id UUID,
  session_start TIMESTAMPTZ,
  bankrupt_landed BOOLEAN,
  total_spins INTEGER
) AS $$
DECLARE
  v_session RECORD;
  v_user_id UUID;
  v_today DATE;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_today := CURRENT_DATE;

  -- Check for existing session today
  SELECT * INTO v_session
  FROM wheel_sessions
  WHERE wheel_sessions.user_id = v_user_id 
    AND DATE(session_start) = v_today
  ORDER BY session_start DESC
  LIMIT 1;

  -- Create new session if none exists
  IF v_session IS NULL THEN
    INSERT INTO wheel_sessions (user_id, session_start, bankrupt_landed, total_spins)
    VALUES (v_user_id, NOW(), false, 0)
    RETURNING * INTO v_session;
  END IF;

  -- Return with explicit table prefix to avoid ambiguity
  RETURN QUERY 
    SELECT v_session.id, v_session.user_id, v_session.session_start, v_session.bankrupt_landed, v_session.total_spins;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_or_create_wheel_session TO authenticated;
