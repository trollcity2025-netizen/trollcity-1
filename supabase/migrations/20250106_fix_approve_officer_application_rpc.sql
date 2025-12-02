-- Fix approve_officer_application to use p_user_id parameter
-- This matches the frontend call format: approve_officer_application({ p_user_id: application.user_id })

CREATE OR REPLACE FUNCTION approve_officer_application(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application RECORD;
  v_reviewer RECORD;
BEGIN
  -- Check if reviewer is admin or lead officer
  SELECT * INTO v_reviewer
  FROM user_profiles
  WHERE id = auth.uid();

  IF NOT (v_reviewer.role = 'admin' OR v_reviewer.is_admin = TRUE OR v_reviewer.is_lead_officer = TRUE) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only admins and lead officers can approve officer applications');
  END IF;

  -- Find pending officer application for this user
  SELECT * INTO v_application
  FROM applications
  WHERE user_id = p_user_id 
    AND type = 'troll_officer'
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_application IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'No pending officer application found for this user');
  END IF;

  -- Update application status
  UPDATE applications
  SET 
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = NOW()
  WHERE id = v_application.id;

  -- Update user role
  UPDATE user_profiles
  SET 
    role = 'troll_officer',
    is_troll_officer = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Create notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
    p_user_id,
    'officer_update',
    'Officer Application Approved',
    'Congratulations! Your Troll Officer application has been approved. Complete orientation to become active.',
    jsonb_build_object('link', '/officer/orientation')
  );

  RETURN jsonb_build_object('success', TRUE, 'message', 'Officer application approved successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION approve_officer_application(UUID) TO authenticated;

COMMENT ON FUNCTION approve_officer_application IS 'Approves a pending officer application by user_id (admins and lead officers only). Call with: { p_user_id: application.user_id }';
