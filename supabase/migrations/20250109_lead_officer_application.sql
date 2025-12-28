-- Lead Officer Application System
-- Only one lead officer position can be filled

-- Add lead_officer_application type to applications table
-- (Assuming applications table exists with a type column)

-- Create function to check if lead officer position is filled
CREATE OR REPLACE FUNCTION is_lead_officer_position_filled()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM user_profiles
  WHERE is_lead_officer = TRUE AND is_banned = FALSE;
  
  RETURN v_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION is_lead_officer_position_filled() TO authenticated;

-- Function to approve lead officer application
CREATE OR REPLACE FUNCTION approve_lead_officer_application(
  p_application_id UUID,
  p_reviewer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application RECORD;
  v_reviewer user_profiles;
  v_position_filled BOOLEAN;
BEGIN
  -- Check if reviewer is admin
  SELECT * INTO v_reviewer
  FROM user_profiles
  WHERE id = p_reviewer_id;

  IF NOT (v_reviewer.role = 'admin' OR v_reviewer.is_admin = TRUE) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only admins can approve lead officer applications');
  END IF;

  -- Check if position is already filled
  SELECT is_lead_officer_position_filled() INTO v_position_filled;
  IF v_position_filled THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Lead officer position is already filled');
  END IF;

  -- Get application
  SELECT * INTO v_application
  FROM applications
  WHERE id = p_application_id AND type = 'lead_officer';

  IF v_application IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Application not found');
  END IF;

  -- Update application status
  UPDATE applications
  SET status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW()
  WHERE id = p_application_id;

  -- Grant lead officer status
  UPDATE user_profiles
  SET is_lead_officer = TRUE,
      updated_at = NOW()
  WHERE id = v_application.user_id;

  -- Create notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
    v_application.user_id,
    'officer_update',
    'Lead Officer Application Approved',
    'Congratulations! Your Lead Officer application has been approved. You can now manage Troll Officers.',
    jsonb_build_object('link', '/admin/applications')
  );

  RETURN jsonb_build_object('success', TRUE, 'message', 'Lead officer application approved');
END;
$$;

GRANT EXECUTE ON FUNCTION approve_lead_officer_application(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION is_lead_officer_position_filled IS 'Checks if lead officer position is already filled';
COMMENT ON FUNCTION approve_lead_officer_application IS 'Approves a lead officer application (admin only)';

