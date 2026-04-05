-- First, insert missing president and vice_president roles if they don't exist
INSERT INTO public.system_roles (name, hierarchy_rank, is_staff, is_admin, description) VALUES
    ('president', 175, true, true, 'President - head of executive branch'),
    ('vice_president', 170, true, true, 'Vice President - deputy executive')
ON CONFLICT (name) DO NOTHING;

-- Now set user as current President
-- User ID: 13113269-7c07-48b9-b70e-dc69fb988840

DO $$
DECLARE
  v_role_id UUID;
  v_user_id UUID := '13113269-7c07-48b9-b70e-dc69fb988840'::UUID;
  v_term_end TIMESTAMPTZ;
BEGIN
  -- Get President Role ID
  SELECT id INTO v_role_id FROM system_roles WHERE name = 'president';
  
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'System role "president" not found after insert';
  END IF;

  -- Term is 14 days from now
  v_term_end := NOW() + INTERVAL '14 days';

  -- Expire any existing president role grants
  UPDATE user_role_grants
  SET expires_at = NOW()
  WHERE role_id = v_role_id 
    AND (expires_at IS NULL OR expires_at > NOW());

  -- Grant new president role
  INSERT INTO user_role_grants (user_id, role_id, expires_at)
  VALUES (v_user_id, v_role_id, v_term_end);

  -- Remove 'president' badge from old presidents
  UPDATE user_profiles
  SET badge = NULL, username_style = NULL
  WHERE badge = 'president';

  -- Award Badge and Gold Style to new president
  UPDATE user_profiles
  SET badge = 'president', username_style = 'gold'
  WHERE id = v_user_id;

  -- Also update role field directly
  UPDATE user_profiles
  SET role = 'president'
  WHERE id = v_user_id;

  RAISE NOTICE 'User % is now set as President', v_user_id;
END
$$;