-- Lead Officer System
-- Lead officers can approve/fire troll officers

-- Add lead_officer field to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_lead_officer BOOLEAN DEFAULT FALSE;

-- Add index for lead officers
CREATE INDEX IF NOT EXISTS idx_user_profiles_lead_officer ON user_profiles(is_lead_officer) WHERE is_lead_officer = TRUE;

-- Function to fire/downgrade an officer to regular user
CREATE OR REPLACE FUNCTION fire_officer(
  p_officer_id UUID,
  p_fired_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_firer_profile user_profiles;
  v_officer_profile user_profiles;
BEGIN
  -- Get firer profile
  SELECT * INTO v_firer_profile
  FROM user_profiles
  WHERE id = p_fired_by;

  -- Check if firer is lead officer or admin
  IF NOT (v_firer_profile.is_lead_officer = TRUE OR v_firer_profile.role = 'admin' OR v_firer_profile.is_admin = TRUE) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Unauthorized: Only lead officers and admins can fire officers');
  END IF;

  -- Get officer profile
  SELECT * INTO v_officer_profile
  FROM user_profiles
  WHERE id = p_officer_id;

  IF v_officer_profile IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Officer not found');
  END IF;

  -- Check if user is actually an officer
  IF NOT (v_officer_profile.is_troll_officer = TRUE OR v_officer_profile.role = 'troll_officer') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'User is not an officer');
  END IF;

  -- Downgrade officer to regular user
  UPDATE user_profiles
  SET
    is_troll_officer = FALSE,
    is_officer = FALSE,
    is_officer_active = FALSE,
    role = 'user',
    officer_level = NULL,
    updated_at = NOW()
  WHERE id = p_officer_id;

  -- Remove officer badge
  DELETE FROM user_badges
  WHERE user_id = p_officer_id
    AND badge_id IN (SELECT id FROM badges WHERE badge_key = 'troll_officer');

  -- Create notification for fired officer
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
    p_officer_id,
    'moderation_action',
    'Officer Status Revoked',
    COALESCE(p_reason, 'Your Troll Officer status has been revoked. You are now a regular user.'),
    jsonb_build_object(
      'fired_by', p_fired_by,
      'fired_by_username', v_firer_profile.username,
      'reason', p_reason
    )
  );

  -- Log the action
  INSERT INTO moderation_actions (
    action_type,
    target_user_id,
    reason,
    action_details,
    created_by
  ) VALUES (
    'fire_officer',
    p_officer_id,
    COALESCE(p_reason, 'Officer status revoked by lead officer/admin'),
    jsonb_build_object(
      'fired_by', p_fired_by,
      'previous_role', 'troll_officer',
      'new_role', 'user'
    ),
    p_fired_by
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Officer fired successfully',
    'officer_id', p_officer_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fire_officer(UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION fire_officer IS 'Allows lead officers and admins to fire/downgrade troll officers to regular users';
COMMENT ON COLUMN user_profiles.is_lead_officer IS 'Lead officers can approve/fire troll officers';

