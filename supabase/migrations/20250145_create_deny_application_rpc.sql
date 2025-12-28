-- Create generic deny_application function for non-officer applications
-- This handles troller, troll_family, and other application types

CREATE OR REPLACE FUNCTION deny_application(
  p_app_id UUID,
  p_reviewer_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application RECORD;
  v_reviewer RECORD;
BEGIN
  -- Check if reviewer is admin
  SELECT * INTO v_reviewer
  FROM user_profiles
  WHERE id = p_reviewer_id;

  IF NOT (v_reviewer.role = 'admin' OR v_reviewer.is_admin = TRUE) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only admins can deny applications');
  END IF;

  -- Get application
  SELECT * INTO v_application
  FROM applications
  WHERE id = p_app_id AND status = 'pending';

  IF v_application IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Application not found or already processed');
  END IF;

  -- Update application status
  UPDATE applications
  SET 
    status = 'rejected',
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW(),
    updated_at = NOW(),
    -- Store rejection reason in data JSONB if reason provided
    data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('rejection_reason', p_reason)
  WHERE id = p_app_id;

  -- Create notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
    v_application.user_id,
    'application_rejected',
    'Application Rejected',
    format('Your %s application has been rejected.%s', 
      v_application.type,
      CASE WHEN p_reason IS NOT NULL THEN ' Reason: ' || p_reason ELSE '' END
    ),
    jsonb_build_object('link', '/profile')
  );

  RETURN jsonb_build_object('success', TRUE, 'message', 'Application rejected successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION deny_application(UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION deny_application IS 'Generic function to deny/reject non-officer applications (troller, troll_family, etc.). Call with: { p_app_id: application.id, p_reviewer_id: user.id, p_reason: "reason text" }';

