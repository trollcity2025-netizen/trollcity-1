-- Migration: Fix ban_user status values in moderation_actions
CREATE OR REPLACE FUNCTION public.ban_user(
  target UUID,
  minutes INTEGER,
  reason TEXT,
  acting_admin_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_is_admin BOOLEAN;
  v_is_lead BOOLEAN;
  v_is_officer BOOLEAN;
  v_target_is_admin BOOLEAN;
  v_until TIMESTAMPTZ;
BEGIN
  v_actor_id := auth.uid();

  -- Service Role Bypass
  IF auth.role() = 'service_role' AND acting_admin_id IS NOT NULL THEN
      v_actor_id := acting_admin_id;
  END IF;

  -- Actor permissions
  SELECT role, is_admin, is_lead_officer, is_troll_officer
  INTO v_actor_role, v_is_admin, v_is_lead, v_is_officer
  FROM public.user_profiles
  WHERE id = v_actor_id;

  IF NOT (v_is_admin OR v_is_lead OR v_is_officer OR v_actor_role IN ('admin','lead_troll_officer','troll_officer')) THEN
    INSERT INTO public.moderation_actions(actor_id, target_user_id, action_type, reason, status, error_message)
    VALUES (v_actor_id, target, 'ban_user', reason, 'rejected', 'Not authorized');
    RETURN jsonb_build_object('status','error','message','Not authorized');
  END IF;

  -- Block banning admin
  SELECT (role = 'admin' OR is_admin = true)
  INTO v_target_is_admin
  FROM public.user_profiles
  WHERE id = target;

  IF v_target_is_admin THEN
    INSERT INTO public.moderation_actions(actor_id, target_user_id, action_type, reason, status, error_message)
    VALUES (v_actor_id, target, 'ban_user', reason, 'rejected', 'Cannot ban admin');
    RETURN jsonb_build_object('status','error','message','Cannot ban admin');
  END IF;

  -- Duration
  v_until := CASE WHEN minutes > 0 THEN now() + (minutes || ' minutes')::interval ELSE NULL END;

  UPDATE public.user_profiles
  SET
    is_banned = true,
    banned_until = v_until,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ban_reason', reason),
    updated_at = now()
  WHERE id = target;

  INSERT INTO public.moderation_actions(actor_id, target_user_id, action_type, reason, payload, status)
  VALUES (
    v_actor_id,
    target,
    'ban_user',
    reason,
    jsonb_build_object('minutes', minutes, 'banned_until', v_until),
    'active'
  );

  RETURN jsonb_build_object('status','ok','banned_until', v_until);

EXCEPTION WHEN others THEN
  INSERT INTO public.moderation_actions(actor_id, target_user_id, action_type, reason, status, error_message)
  VALUES (v_actor_id, target, 'ban_user', reason, 'rejected', sqlerrm);
  RETURN jsonb_build_object('status','error','message','Ban failed','error', sqlerrm);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
