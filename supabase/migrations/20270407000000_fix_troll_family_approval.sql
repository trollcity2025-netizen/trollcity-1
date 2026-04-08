-- Fix troll family application approval: automatically create family when application is approved
CREATE OR REPLACE FUNCTION public.approve_application(
  p_app_id uuid,
  p_reviewer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_application RECORD;
  v_reviewer RECORD;
  v_role_to_grant TEXT;
  v_new_family_id UUID;
  v_username TEXT;
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

  -- Update user profile based on type
  IF v_application.type = 'troller' THEN
    UPDATE user_profiles
    SET 
      role = 'troller',
      is_troller = TRUE,
      updated_at = NOW()
    WHERE id = v_application.user_id;

  ELSIF v_application.type = 'troll_family' THEN
    -- Get user's username for family name
    SELECT username INTO v_username
    FROM user_profiles
    WHERE id = v_application.user_id;

    -- 1. Update user role
    UPDATE user_profiles
    SET 
      role = 'troll_family',
      updated_at = NOW()
    WHERE id = v_application.user_id;

    -- 2. Create new family for the user
    INSERT INTO troll_families (
      id,
      name,
      description,
      leader_id,
      created_by,
      created_at,
      updated_at,
      level,
      reputation,
      legacy_score,
      xp
    ) VALUES (
      gen_random_uuid(),
      COALESCE(v_username, 'New Family') || '''s Family',
      'Family created automatically on application approval',
      v_application.user_id,
      v_application.user_id,
      NOW(),
      NOW(),
      1,
      0,
      0,
      0
    ) RETURNING id INTO v_new_family_id;

    -- 3. Add user to both family member tables (fixes duplicate table issue)
    INSERT INTO family_members (
      user_id,
      family_id,
      role,
      joined_at
    ) VALUES (
      v_application.user_id,
      v_new_family_id,
      'leader',
      NOW()
    )
    ON CONFLICT (family_id, user_id) DO NOTHING;

    INSERT INTO troll_family_members (
      user_id,
      family_id,
      role,
      joined_at
    ) VALUES (
      v_application.user_id,
      v_new_family_id,
      'leader',
      NOW()
    )
    ON CONFLICT (family_id, user_id) DO NOTHING;

    -- 4. Create family stats row
    INSERT INTO family_stats (family_id)
    VALUES (v_new_family_id)
    ON CONFLICT (family_id) DO NOTHING;
  END IF;

  -- Notification
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
    format('Your %s application has been approved! Your family has been created.', v_application.type),
    jsonb_build_object('link', '/family/home')
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', format('Application approved successfully. User granted role: %s', v_role_to_grant)
  );
END;
$$;

ALTER FUNCTION public.approve_application(uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.approve_application(uuid, uuid) TO authenticated;
