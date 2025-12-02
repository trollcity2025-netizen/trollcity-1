-- Create generic approve_application function for non-officer applications
-- This handles troller, troll_family, and other application types

CREATE OR REPLACE FUNCTION approve_application(
  p_app_id UUID,
  p_reviewer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application RECORD;
  v_reviewer RECORD;
  v_role_to_grant TEXT;
BEGIN
  -- Check if reviewer is admin
  SELECT * INTO v_reviewer
  FROM user_profiles
  WHERE id = p_reviewer_id;

  IF NOT (v_reviewer.role = 'admin' OR v_reviewer.is_admin = TRUE) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only admins can approve applications');
  END IF;

  -- Get application
  SELECT * INTO v_application
  FROM applications
  WHERE id = p_app_id AND status = 'pending';

  IF v_application IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Application not found or already processed');
  END IF;

  -- Determine role to grant based on application type
  CASE v_application.type
    WHEN 'troller' THEN
      v_role_to_grant := 'troller';
    WHEN 'troll_family' THEN
      v_role_to_grant := 'troll_family';
    ELSE
      v_role_to_grant := v_application.type;
  END CASE;

  -- Update application status
  UPDATE applications
  SET 
    status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_app_id;

  -- Update user profile based on application type
  IF v_application.type = 'troller' THEN
    UPDATE user_profiles
    SET 
      role = 'troller',
      is_troller = TRUE,
      updated_at = NOW()
    WHERE id = v_application.user_id;
  ELSIF v_application.type = 'troll_family' THEN
    UPDATE user_profiles
    SET 
      role = 'troll_family',
      updated_at = NOW()
    WHERE id = v_application.user_id;
  END IF;

  -- Create notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
    v_application.user_id,
    'application_approved',
    'Application Approved',
    format('Your %s application has been approved!', v_application.type),
    jsonb_build_object('link', '/profile')
  );

  RETURN jsonb_build_object('success', TRUE, 'message', format('Application approved successfully. User granted role: %s', v_role_to_grant));
END;
$$;

GRANT EXECUTE ON FUNCTION approve_application(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION approve_application IS 'Generic function to approve non-officer applications (troller, troll_family, etc.). Call with: { p_app_id: application.id, p_reviewer_id: user.id }';

