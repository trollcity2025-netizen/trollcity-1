-- 20260408000000_family_ban_member.sql

-- 1. Add table to track family bans.
CREATE TABLE IF NOT EXISTS public.family_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid NOT NULL,
  banned_by uuid NOT NULL,
  reason text,
  banned_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT family_bans_family_user_key UNIQUE (family_id, user_id)
);

ALTER TABLE public.family_bans
  OWNER TO postgres;

-- 2. Ensure family bans cascade with family removal and user cleanup.
ALTER TABLE public.family_bans
  ADD CONSTRAINT family_bans_family_id_fkey FOREIGN KEY (family_id)
    REFERENCES public.troll_families (id) ON DELETE CASCADE;

ALTER TABLE public.family_bans
  ADD CONSTRAINT family_bans_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.user_profiles (id) ON DELETE CASCADE;

ALTER TABLE public.family_bans
  ADD CONSTRAINT family_bans_banned_by_fkey FOREIGN KEY (banned_by)
    REFERENCES public.user_profiles (id);

-- 3. Create function to ban family members.
CREATE OR REPLACE FUNCTION public.ban_family_member(
  p_family_id UUID,
  p_target_user_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_admin_role TEXT;
BEGIN
  SELECT fm.role INTO v_admin_role
  FROM public.family_members fm
  WHERE fm.family_id = p_family_id AND fm.user_id = p_admin_user_id;

  IF v_admin_role NOT IN ('leader', 'co_leader') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only family leaders can ban members'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = p_family_id
      AND user_id = p_target_user_id
      AND role = 'leader'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot ban the family leader'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.family_bans
    WHERE family_id = p_family_id
      AND user_id = p_target_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User is already banned from this family'
    );
  END IF;

  INSERT INTO public.family_bans (family_id, user_id, banned_by, reason)
  VALUES (p_family_id, p_target_user_id, p_admin_user_id, p_reason);

  DELETE FROM public.family_members
  WHERE family_id = p_family_id AND user_id = p_target_user_id;

  DELETE FROM public.troll_family_members
  WHERE family_id = p_family_id AND user_id = p_target_user_id;

  INSERT INTO public.family_notifications (
    family_id,
    title,
    message,
    severity,
    is_read,
    notification_type,
    related_user_id
  ) VALUES (
    p_family_id,
    'Member Banned',
    'A member has been banned from the family.',
    'urgent',
    false,
    'member_ban',
    p_target_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Member banned successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update join function to honor family bans.
CREATE OR REPLACE FUNCTION public.join_family(
  p_family_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.family_bans
    WHERE family_id = p_family_id
      AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You are banned from joining this family'
    );
  END IF;

  IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You are already in a family'
    );
  END IF;

  IF EXISTS (SELECT 1 FROM public.troll_family_members WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You are already in a family'
    );
  END IF;

  INSERT INTO public.family_members (user_id, family_id, role)
  VALUES (p_user_id, p_family_id, 'member')
  ON CONFLICT (family_id, user_id) DO NOTHING;

  INSERT INTO public.troll_family_members (user_id, family_id, role)
  VALUES (p_user_id, p_family_id, 'member')
  ON CONFLICT (family_id, user_id) DO NOTHING;

  INSERT INTO public.family_notifications (
    family_id,
    title,
    message,
    severity,
    is_read,
    notification_type
  ) VALUES (
    p_family_id,
    '👋 New Member!',
    'A new member has joined the family!',
    'info',
    false,
    'member_join'
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Successfully joined family'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant execute permissions.
GRANT EXECUTE ON FUNCTION public.ban_family_member(UUID, UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_family(UUID, UUID) TO authenticated, service_role;
