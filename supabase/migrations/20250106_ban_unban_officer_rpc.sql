-- RPC functions for banning and unbanning officers
-- Used by Lead Officers and Admins

-- Ban officer function
CREATE OR REPLACE FUNCTION ban_officer(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_officer RECORD;
  v_actor RECORD;
BEGIN
  -- Get actor (must be admin or lead officer)
  SELECT * INTO v_actor
  FROM user_profiles
  WHERE id = auth.uid()
    AND (role = 'admin' OR is_admin = true OR is_lead_officer = true);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only admins and lead officers can ban officers');
  END IF;

  -- Get officer to ban
  SELECT * INTO v_officer
  FROM user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Officer not found');
  END IF;

  -- Ban the officer
  UPDATE user_profiles
  SET 
    is_banned = TRUE,
    banned_until = p_expires_at,
    is_officer_active = FALSE, -- Deactivate officer status
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Store ban reason in metadata if metadata column exists
  BEGIN
    UPDATE user_profiles
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('ban_reason', p_reason)
    WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- metadata column might not exist, ignore
    NULL;
  END;

  -- Log the action (if officer_actions table exists)
  BEGIN
    INSERT INTO officer_actions (
      officer_id,
      target_user_id,
      action_type,
      reason
    ) VALUES (
      auth.uid(), -- The officer performing the action
      p_user_id,  -- The target officer being banned
      'ban',
      p_reason
    );
  EXCEPTION WHEN OTHERS THEN
    -- Table might not exist or have different schema, ignore
    NULL;
  END;

  RETURN jsonb_build_object('success', TRUE, 'message', 'Officer banned successfully');
END;
$$;

-- Unban officer function
CREATE OR REPLACE FUNCTION unban_officer(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_officer RECORD;
  v_actor RECORD;
BEGIN
  -- Get actor (must be admin or lead officer)
  SELECT * INTO v_actor
  FROM user_profiles
  WHERE id = auth.uid()
    AND (role = 'admin' OR is_admin = true OR is_lead_officer = true);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only admins and lead officers can unban officers');
  END IF;

  -- Get officer to unban
  SELECT * INTO v_officer
  FROM user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Officer not found');
  END IF;

  -- Unban the officer
  UPDATE user_profiles
  SET 
    is_banned = FALSE,
    banned_until = NULL,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Remove ban reason from metadata if metadata column exists
  BEGIN
    UPDATE user_profiles
    SET metadata = COALESCE(metadata, '{}'::jsonb) - 'ban_reason'
    WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- metadata column might not exist, ignore
    NULL;
  END;

  -- Log the action (if officer_actions table exists)
  BEGIN
    INSERT INTO officer_actions (
      officer_id,
      target_user_id,
      action_type,
      reason
    ) VALUES (
      auth.uid(), -- The officer performing the action
      p_user_id,  -- The target officer being unbanned
      'unban',
      'Officer unbanned'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Table might not exist or have different schema, ignore
    NULL;
  END;

  RETURN jsonb_build_object('success', TRUE, 'message', 'Officer unbanned successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION ban_officer(UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION unban_officer(UUID) TO authenticated;

COMMENT ON FUNCTION ban_officer IS 'Bans an officer (lead officers and admins only)';
COMMENT ON FUNCTION unban_officer IS 'Unbans an officer (lead officers and admins only)';

