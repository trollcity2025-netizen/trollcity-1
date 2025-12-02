-- Update approve/reject functions to automatically use auth.uid() instead of requiring reviewer_id
-- This makes the frontend calls simpler - no need to pass user.id

-- Drop old function if it exists (with 2 parameters)
DROP FUNCTION IF EXISTS public.approve_broadcaster(UUID, UUID);

-- Updated approve function - automatically uses logged-in user (1 parameter only)
CREATE OR REPLACE FUNCTION approve_broadcaster(
  p_application_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_reviewer_id UUID;
BEGIN
  -- Get the current authenticated user
  v_reviewer_id := auth.uid();
  
  IF v_reviewer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Get user_id from application
  SELECT user_id INTO v_user_id
  FROM broadcaster_applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;

  -- Mark application approved
  UPDATE broadcaster_applications
  SET 
    application_status = 'approved',
    reviewed_at = NOW(),
    reviewed_by = v_reviewer_id,
    updated_at = NOW()
  WHERE id = p_application_id;

  -- Grant user broadcaster status
  UPDATE user_profiles
  SET is_broadcaster = true, updated_at = NOW()
  WHERE id = v_user_id;

  -- Notify user
  INSERT INTO notifications (user_id, message, type, read)
  VALUES (v_user_id, '🎉 Your broadcaster application has been approved! You can now Go Live.', 'success', false);

  RETURN jsonb_build_object('success', true, 'message', 'Broadcaster approved successfully!');
END;
$$;

-- Drop old reject function if it exists (with 4 parameters)
DROP FUNCTION IF EXISTS public.reject_broadcaster_application(UUID, UUID, TEXT, TEXT);

-- Updated reject function - automatically uses logged-in user (3 parameters, no admin_id)
CREATE OR REPLACE FUNCTION reject_broadcaster_application(
  p_application_id UUID,
  p_rejection_reason TEXT,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_application RECORD;
  v_reviewer_id UUID;
BEGIN
  -- Get the current authenticated user
  v_reviewer_id := auth.uid();
  
  IF v_reviewer_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Get the application
  SELECT * INTO v_application
  FROM public.broadcaster_applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Application not found');
  END IF;

  IF v_application.application_status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Application is not pending');
  END IF;

  -- Update application status
  UPDATE public.broadcaster_applications
  SET 
    application_status = 'rejected',
    reviewed_by = v_reviewer_id,
    reviewed_at = NOW(),
    rejection_reason = p_rejection_reason,
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    updated_at = NOW()
  WHERE id = p_application_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Application rejected successfully'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION approve_broadcaster(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_broadcaster_application(UUID, TEXT, TEXT) TO authenticated;

