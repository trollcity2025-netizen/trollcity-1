-- ============================================
-- STEP 1: Check what functions currently exist
-- ============================================
SELECT 
  routine_name,
  routine_type,
  data_type as return_type,
  string_agg(parameter_name || ' ' || data_type, ', ' ORDER BY ordinal_position) as parameters
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p 
  ON r.specific_name = p.specific_name
WHERE r.routine_schema = 'public'
  AND r.routine_name IN ('approve_broadcaster', 'reject_broadcaster_application')
GROUP BY routine_name, routine_type, data_type
ORDER BY routine_name;

-- ============================================
-- STEP 2: Drop ALL existing versions of these functions
-- ============================================
-- This ensures we start fresh
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT 'DROP FUNCTION IF EXISTS ' || routine_schema || '.' || routine_name || '(' || 
           COALESCE(string_agg(parameter_name || ' ' || data_type, ', ' ORDER BY ordinal_position), '') || ');' as drop_stmt
    FROM information_schema.routines
    LEFT JOIN information_schema.parameters 
      ON routines.specific_name = parameters.specific_name
    WHERE routine_schema = 'public'
      AND routine_name IN ('approve_broadcaster', 'reject_broadcaster_application')
    GROUP BY routine_schema, routine_name, specific_name
  LOOP
    EXECUTE r.drop_stmt;
    RAISE NOTICE 'Dropped: %', r.drop_stmt;
  END LOOP;
END $$;

-- ============================================
-- STEP 3: Create the NEW approve function (1 parameter)
-- ============================================
CREATE FUNCTION approve_broadcaster(
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
  -- Automatically get the logged-in user
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
  VALUES (v_user_id, '🎉 Your broadcaster application has been approved! You can now Go Live.', 'success', false)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'message', 'Broadcaster approved successfully!');
END;
$$;

-- ============================================
-- STEP 4: Create the NEW reject function (3 parameters)
-- ============================================
CREATE FUNCTION reject_broadcaster_application(
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
  -- Automatically get the logged-in user
  v_reviewer_id := auth.uid();
  
  IF v_reviewer_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Get the application
  SELECT * INTO v_application
  FROM broadcaster_applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Application not found');
  END IF;

  IF v_application.application_status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Application is not pending');
  END IF;

  -- Update application status
  UPDATE broadcaster_applications
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

-- ============================================
-- STEP 5: Grant permissions
-- ============================================
GRANT EXECUTE ON FUNCTION approve_broadcaster(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_broadcaster_application(UUID, TEXT, TEXT) TO authenticated;

-- ============================================
-- STEP 6: VERIFY - Should show 2 functions
-- ============================================
SELECT 
  routine_name,
  'EXISTS ✓' as status,
  string_agg(parameter_name || ' ' || data_type, ', ' ORDER BY ordinal_position) as parameters
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p 
  ON r.specific_name = p.specific_name
WHERE r.routine_schema = 'public'
  AND r.routine_name IN ('approve_broadcaster', 'reject_broadcaster_application')
GROUP BY routine_name
ORDER BY routine_name;

