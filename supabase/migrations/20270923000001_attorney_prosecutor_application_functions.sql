-- ============================================================================
-- ATTORNEY & PROSECUTOR APPLICATION FUNCTIONS
-- Handles submit, approve, deny for attorney and prosecutor applications
-- ============================================================================

-- ============================================================================
-- SUBMIT ATTORNEY APPLICATION
-- ============================================================================
DROP FUNCTION IF EXISTS public.submit_attorney_application(UUID, INTEGER, BOOLEAN);
CREATE FUNCTION public.submit_attorney_application(
  p_user_id UUID,
  p_attorney_fee INTEGER DEFAULT 0,
  p_is_pro_bono BOOLEAN DEFAULT FALSE
)
RETURNS JSON AS $$
DECLARE
  v_existing_app RECORD;
BEGIN
  -- Check if user already has a pending application
  SELECT * INTO v_existing_app 
  FROM attorney_applications 
  WHERE user_id = p_user_id AND status = 'pending';

  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'You already have a pending attorney application');
  END IF;

  -- Check if user is already an attorney
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = p_user_id AND is_attorney = true) THEN
    RETURN json_build_object('success', false, 'error', 'You are already an attorney');
  END IF;

  -- Insert the application
  INSERT INTO attorney_applications (user_id, attorney_fee, is_pro_bono, status)
  VALUES (p_user_id, p_attorney_fee, p_is_pro_bono, 'pending');

  RETURN json_build_object('success', true, 'message', 'Attorney application submitted successfully');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SUBMIT PROSECUTOR APPLICATION
-- ============================================================================
DROP FUNCTION IF EXISTS public.submit_prosecutor_application(UUID, TEXT);
CREATE FUNCTION public.submit_prosecutor_application(
  p_user_id UUID,
  p_experience TEXT DEFAULT ''
)
RETURNS JSON AS $$
DECLARE
  v_existing_app RECORD;
BEGIN
  -- Check if user already has a pending application
  SELECT * INTO v_existing_app 
  FROM prosecutor_applications 
  WHERE user_id = p_user_id AND status = 'pending';

  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'You already have a pending prosecutor application');
  END IF;

  -- Check if user is already a prosecutor
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = p_user_id AND is_prosecutor = true) THEN
    RETURN json_build_object('success', false, 'error', 'You are already a prosecutor');
  END IF;

  -- Insert the application
  INSERT INTO prosecutor_applications (user_id, experience, status)
  VALUES (p_user_id, p_experience, 'pending');

  RETURN json_build_object('success', true, 'message', 'Prosecutor application submitted successfully');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- APPROVE ATTORNEY APPLICATION
-- ============================================================================
DROP FUNCTION IF EXISTS public.approve_attorney_application(UUID, UUID);
CREATE FUNCTION public.approve_attorney_application(
  p_application_id UUID,
  p_reviewer_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_app RECORD;
  v_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Permission check - directly check is_admin flag
  SELECT is_admin INTO v_is_admin FROM user_profiles WHERE id = p_reviewer_id;
  IF COALESCE(v_is_admin, false) = false THEN
    RETURN json_build_object('success', false, 'error', 'Access denied: Admin only');
  END IF;

  -- Get application
  SELECT * INTO v_app FROM attorney_applications WHERE id = p_application_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Application not found');
  END IF;

  IF v_app.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Application is not pending');
  END IF;

  v_user_id := v_app.user_id;

  -- Update user profile to make them an attorney
  UPDATE user_profiles
  SET is_attorney = true,
      attorney_fee = v_app.attorney_fee,
      is_pro_bono = v_app.is_pro_bono,
      badge_attorney = 'Attorney',
      updated_at = NOW()
  WHERE id = v_user_id;

  -- Update application status
  UPDATE attorney_applications
  SET status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW()
  WHERE id = p_application_id;

  -- Send notification
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    v_user_id, 
    'application_result', 
    'Attorney Application Approved', 
    'Congratulations! You have been approved as an attorney. You can now represent clients in court.'
  );

  RETURN json_build_object('success', true, 'message', 'Attorney application approved');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- APPROVE PROSECUTOR APPLICATION
-- ============================================================================
DROP FUNCTION IF EXISTS public.approve_prosecutor_application(UUID, UUID);
CREATE FUNCTION public.approve_prosecutor_application(
  p_application_id UUID,
  p_reviewer_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_app RECORD;
  v_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Permission check - directly check is_admin flag
  SELECT is_admin INTO v_is_admin FROM user_profiles WHERE id = p_reviewer_id;
  IF COALESCE(v_is_admin, false) = false THEN
    RETURN json_build_object('success', false, 'error', 'Access denied: Admin only');
  END IF;

  -- Get application
  SELECT * INTO v_app FROM prosecutor_applications WHERE id = p_application_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Application not found');
  END IF;

  IF v_app.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Application is not pending');
  END IF;

  v_user_id := v_app.user_id;

  -- Update user profile to make them a prosecutor
  UPDATE user_profiles
  SET is_prosecutor = true,
      badge_prosecutor = 'Prosecutor',
      updated_at = NOW()
  WHERE id = v_user_id;

  -- Update application status
  UPDATE prosecutor_applications
  SET status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW()
  WHERE id = p_application_id;

  -- Send notification
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    v_user_id, 
    'application_result', 
    'Prosecutor Application Approved', 
    'Congratulations! You have been approved as a prosecutor. You can now prosecute cases in court.'
  );

  RETURN json_build_object('success', true, 'message', 'Prosecutor application approved');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DENY ATTORNEY APPLICATION
-- ============================================================================
DROP FUNCTION IF EXISTS public.deny_attorney_application(UUID, UUID, TEXT);
CREATE FUNCTION public.deny_attorney_application(
  p_application_id UUID,
  p_reviewer_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_app RECORD;
  v_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Permission check - directly check is_admin flag
  SELECT is_admin INTO v_is_admin FROM user_profiles WHERE id = p_reviewer_id;
  IF COALESCE(v_is_admin, false) = false THEN
    RETURN json_build_object('success', false, 'error', 'Access denied: Admin only');
  END IF;

  -- Get application
  SELECT * INTO v_app FROM attorney_applications WHERE id = p_application_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Application not found');
  END IF;

  v_user_id := v_app.user_id;

  -- Update application status
  UPDATE attorney_applications
  SET status = 'rejected',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW(),
      data = jsonb_set(data, '{rejection_reason}', to_jsonb(p_reason))
  WHERE id = p_application_id;

  -- Send notification
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    v_user_id, 
    'application_result', 
    'Attorney Application Denied', 
    'Your attorney application has been denied. Reason: ' || COALESCE(p_reason, 'No reason provided.')
  );

  RETURN json_build_object('success', true, 'message', 'Attorney application denied');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DENY PROSECUTOR APPLICATION
-- ============================================================================
DROP FUNCTION IF EXISTS public.deny_prosecutor_application(UUID, UUID, TEXT);
CREATE FUNCTION public.deny_prosecutor_application(
  p_application_id UUID,
  p_reviewer_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_app RECORD;
  v_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Permission check - directly check is_admin flag
  SELECT is_admin INTO v_is_admin FROM user_profiles WHERE id = p_reviewer_id;
  IF COALESCE(v_is_admin, false) = false THEN
    RETURN json_build_object('success', false, 'error', 'Access denied: Admin only');
  END IF;

  -- Get application
  SELECT * INTO v_app FROM prosecutor_applications WHERE id = p_application_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Application not found');
  END IF;

  v_user_id := v_app.user_id;

  -- Update application status
  UPDATE prosecutor_applications
  SET status = 'rejected',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW(),
      data = jsonb_set(data, '{rejection_reason}', to_jsonb(p_reason))
  WHERE id = p_application_id;

  -- Send notification
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    v_user_id, 
    'application_result', 
    'Prosecutor Application Denied', 
    'Your prosecutor application has been denied. Reason: ' || COALESCE(p_reason, 'No reason provided.')
  );

  RETURN json_build_object('success', true, 'message', 'Prosecutor application denied');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT ALL ON FUNCTION public.submit_attorney_application TO authenticated;
GRANT ALL ON FUNCTION public.submit_prosecutor_application TO authenticated;
GRANT ALL ON FUNCTION public.approve_attorney_application TO authenticated;
GRANT ALL ON FUNCTION public.approve_prosecutor_application TO authenticated;
GRANT ALL ON FUNCTION public.deny_attorney_application TO authenticated;
GRANT ALL ON FUNCTION public.deny_prosecutor_application TO authenticated;