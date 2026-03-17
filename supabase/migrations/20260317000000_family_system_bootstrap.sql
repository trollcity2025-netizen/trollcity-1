-- =============================================================================
-- FAMILY SYSTEM BOOTSTRAP & BACKFILL
-- Auto-generates starter data for new families and backfills existing ones
-- =============================================================================

-- 1. Create trigger function for auto-bootstrapping new families
CREATE OR REPLACE FUNCTION public.bootstrap_new_family()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert starter goal if none exist
  IF NOT EXISTS (SELECT 1 FROM public.family_goals WHERE family_id = NEW.id) THEN
    INSERT INTO public.family_goals (
      family_id,
      title,
      description,
      category,
      difficulty,
      target_value,
      current_value,
      status,
      reward_coins,
      bonus_coins,
      reward_xp,
      goal_type,
      expires_at
    ) VALUES (
      NEW.id,
      'Welcome Mission',
      'Earn 1,000 coins together as a family to unlock your first reward!',
      'daily',
      'easy',
      1000,
      0,
      'active',
      100,
      50,
      0,
      'general',
      NOW() + INTERVAL '7 days'
    );
  END IF;

  -- Insert starter notification if none exist
  IF NOT EXISTS (SELECT 1 FROM public.family_notifications WHERE family_id = NEW.id) THEN
    INSERT INTO public.family_notifications (
      family_id,
      title,
      message,
      severity,
      is_read,
      notification_type
    ) VALUES (
      NEW.id,
      '🎉 Family Created!',
      'Your family is now live. Start building your legacy by completing goals together!',
      'info',
      false,
      'system'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger on troll_families INSERT
DROP TRIGGER IF EXISTS trg_bootstrap_family ON public.troll_families;
CREATE TRIGGER trg_bootstrap_family
AFTER INSERT ON public.troll_families
FOR EACH ROW
EXECUTE FUNCTION public.bootstrap_new_family();

-- 3. Backfill existing families with starter goals
INSERT INTO public.family_goals (
  family_id,
  title,
  description,
  category,
  difficulty,
  target_value,
  current_value,
  status,
  reward_coins,
  bonus_coins,
  reward_xp,
  goal_type,
  expires_at
)
SELECT 
  tf.id,
  'Welcome Mission',
  'Earn 1,000 coins together as a family to unlock your first reward!',
  'daily',
  'easy',
  1000,
  0,
  'active',
  100,
  50,
  0,
  'general',
  NOW() + INTERVAL '7 days'
FROM public.troll_families tf
WHERE NOT EXISTS (
  SELECT 1 FROM public.family_goals fg 
  WHERE fg.family_id = tf.id AND fg.status = 'active'
);

-- 4. Backfill existing families with starter notifications
INSERT INTO public.family_notifications (
  family_id,
  title,
  message,
  severity,
  is_read,
  notification_type
)
SELECT 
  tf.id,
  '🎉 Family Created!',
  'Your family is now live. Start building your legacy by completing goals together!',
  'info',
  false,
  'system'
FROM public.troll_families tf
WHERE NOT EXISTS (
  SELECT 1 FROM public.family_notifications fn 
  WHERE fn.family_id = tf.id
);

-- 5. Ensure all families have at least one member (the leader should be in family_members)
-- This assumes there's a creator_id or owner_id column on troll_families
-- If not, we'll check if family has any members
-- First, let's check what columns exist on troll_families
DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  -- Check if creator_id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'troll_families' AND column_name = 'creator_id'
  ) INTO col_exists;
  
  IF col_exists THEN
    -- Insert leaders from creator_id
    INSERT INTO public.family_members (user_id, family_id, role)
    SELECT tf.creator_id, tf.id, 'leader'
    FROM public.troll_families tf
    WHERE tf.creator_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.family_members fm 
      WHERE fm.family_id = tf.id
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 6. Add RLS policy for public read on troll_families (for browse page)
DROP POLICY IF EXISTS "Public read families" ON public.troll_families;
CREATE POLICY "Public read families" ON public.troll_families
FOR SELECT USING (true);

-- 7. Ensure family_members is readable for family browse
DROP POLICY IF EXISTS "Public read family members" ON public.family_members;
CREATE POLICY "Public read family members" ON public.family_members
FOR SELECT USING (true);

-- 8. Create function to join a family
CREATE OR REPLACE FUNCTION public.join_family(
  p_family_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Check if user is already in a family
  IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You are already in a family'
    );
  END IF;

  -- Check if user is already in troll_family_members
  IF EXISTS (SELECT 1 FROM public.troll_family_members WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You are already in a family'
    );
  END IF;

  -- Add user to family_members
  INSERT INTO public.family_members (user_id, family_id, role)
  VALUES (p_user_id, p_family_id, 'member')
  ON CONFLICT (family_id, user_id) DO NOTHING;

  -- Also add to troll_family_members if it exists
  INSERT INTO public.troll_family_members (user_id, family_id, role)
  VALUES (p_user_id, p_family_id, 'member')
  ON CONFLICT (family_id, user_id) DO NOTHING;

  -- Create welcome notification
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

-- 9. Create function to kick a member (only leaders can do this)
CREATE OR REPLACE FUNCTION public.kick_family_member(
  p_family_id UUID,
  p_target_user_id UUID,
  p_admin_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_admin_role TEXT;
BEGIN
  -- Check if admin is leader or co_leader
  SELECT fm.role INTO v_admin_role
  FROM public.family_members fm
  WHERE fm.family_id = p_family_id AND fm.user_id = p_admin_user_id;

  IF v_admin_role NOT IN ('leader', 'co_leader') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only leaders can kick members'
    );
  END IF;

  -- Cannot kick the leader
  IF EXISTS (
    SELECT 1 FROM public.family_members 
    WHERE family_id = p_family_id 
    AND user_id = p_target_user_id 
    AND role = 'leader'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot kick the family leader'
    );
  END IF;

  -- Remove from family_members
  DELETE FROM public.family_members
  WHERE family_id = p_family_id AND user_id = p_target_user_id;

  -- Remove from troll_family_members if exists
  DELETE FROM public.troll_family_members
  WHERE family_id = p_family_id AND user_id = p_target_user_id;

  -- Create notification about kick
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
    'Member Removed',
    'A member has been removed from the family',
    'warning',
    false,
    'member_kick',
    p_target_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Member kicked successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create function to promote a member (only leaders can do this)
CREATE OR REPLACE FUNCTION public.promote_family_member(
  p_family_id UUID,
  p_target_user_id UUID,
  p_new_role TEXT,
  p_admin_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_admin_role TEXT;
BEGIN
  -- Check if admin is leader
  SELECT fm.role INTO v_admin_role
  FROM public.family_members fm
  WHERE fm.family_id = p_family_id AND fm.user_id = p_admin_user_id;

  IF v_admin_role != 'leader' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only the leader can promote members'
    );
  END IF;

  -- Validate role
  IF p_new_role NOT IN ('co_leader', 'scout', 'recruiter', 'mentor', 'member') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid role'
    );
  END IF;

  -- Update role
  UPDATE public.family_members
  SET role = p_new_role, updated_at = NOW()
  WHERE family_id = p_family_id AND user_id = p_target_user_id;

  -- Also update in troll_family_members if exists
  UPDATE public.troll_family_members
  SET role = p_new_role
  WHERE family_id = p_family_id AND user_id = p_target_user_id;

  -- Create notification about promotion
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
    '🎉 Member Promoted!',
    'A member has been promoted to ' || p_new_role,
    'info',
    false,
    'member_promote',
    p_target_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Member promoted successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.bootstrap_new_family() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_family(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kick_family_member(UUID, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.promote_family_member(UUID, UUID, TEXT, UUID) TO authenticated, service_role;

-- 12. Run backfill for all families - add any missing member entries
-- This is a safety check
DO $$
DECLARE
  fam RECORD;
BEGIN
  FOR fam IN SELECT id FROM public.troll_families LOOP
    -- If no members, insert a placeholder (would need creator_id)
    IF (SELECT COUNT(*) FROM public.family_members WHERE family_id = fam.id) = 0 THEN
      RAISE NOTICE 'Family % has no members', fam.id;
    END IF;
  END LOOP;
END $$;

-- 13. Update member_count for all families
UPDATE public.troll_families tf
SET member_count = (
  SELECT COUNT(*) FROM public.family_members fm WHERE fm.family_id = tf.id
);

-- Also account for troll_family_members
UPDATE public.troll_families tf
SET member_count = COALESCE(
  (SELECT COUNT(*) FROM public.family_members fm WHERE fm.family_id = tf.id), 0
) + COALESCE(
  (SELECT COUNT(*) FROM public.troll_family_members tfm WHERE tfm.family_id = tf.id), 0
);

SELECT 'Family bootstrap complete!' as result;
