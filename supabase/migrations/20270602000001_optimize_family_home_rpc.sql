-- Migration: Create aggregated RPC function for Family Home
-- This replaces multiple sequential queries with a single RPC call

-- Create the main aggregated family home data function
CREATE OR REPLACE FUNCTION public.get_family_home_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_family_id UUID;
  v_role TEXT;
  v_result JSONB;
  v_family JSONB;
  v_members JSONB;
  v_goals JSONB;
  v_achievements JSONB;
  v_vault JSONB;
  v_heartbeat JSONB;
  v_notifications JSONB;
BEGIN
  -- 1. Get user's family membership
  SELECT fm.family_id, fm.role INTO v_family_id, v_role
  FROM public.family_members fm
  WHERE fm.user_id = p_user_id
  LIMIT 1;

  -- If not in family_members, check if user is a leader
  IF v_family_id IS NULL THEN
    SELECT tf.id, 'leader' INTO v_family_id, v_role
    FROM public.troll_families tf
    WHERE tf.leader_id = p_user_id
    LIMIT 1;
  END IF;

  -- Return null if user is not in any family
  IF v_family_id IS NULL THEN
    RETURN jsonb_build_object(
      'family', NULL,
      'members', jsonb_build_array(),
      'goals', jsonb_build_array(),
      'achievements', jsonb_build_array(),
      'vault', jsonb_build_object('total_coins', 0, 'weekly_contribution', 0, 'streak_bonus', 0),
      'heartbeat', jsonb_build_object(
        'health', 'unknown',
        'total_members', 0,
        'active_members', 0,
        'at_risk_members', 0,
        'goals_active', 0,
        'goals_completed', 0,
        'current_streak', 0,
        'unread_notifications', 0
      ),
      'notifications', jsonb_build_array(),
      'user_role', NULL
    );
  END IF;

  -- 2. Get family core data (optimized - only needed columns)
  SELECT row_to_json(f) INTO v_family
  FROM (
    SELECT 
      tf.id,
      tf.name,
      tf.family_tag as tag,
      tf.slogan,
      tf.crest_url,
      tf.banner_url,
      tf.level,
      COALESCE(tf.xp, 0) as xp,
      COALESCE(tf.legacy_score, 0) as legacy_score,
      COALESCE(tf.reputation, 0) as reputation,
      tf.member_count
    FROM public.troll_families tf
    WHERE tf.id = v_family_id
  ) f;

  -- 3. Get members (LIMITED to first 10 for performance, with role ordering)
  SELECT COALESCE(jsonb_agg(row_to_json(m)), jsonb_build_array()) INTO v_members
  FROM (
    SELECT 
      fm.id,
      fm.user_id,
      fm.role,
      up.username,
      up.avatar_url,
      up.display_name
    FROM public.family_members fm
    LEFT JOIN public.user_profiles up ON fm.user_id = up.id
    WHERE fm.family_id = v_family_id
    ORDER BY 
      CASE fm.role 
        WHEN 'leader' THEN 1 
        WHEN 'co_leader' THEN 2 
        WHEN 'scout' THEN 3 
        WHEN 'recruiter' THEN 4 
        WHEN 'mentor' THEN 5 
        ELSE 6 
      END,
      fm.joined_at ASC
    LIMIT 10
  ) m;

  -- 4. Get active goals (LIMITED to 10)
  SELECT COALESCE(jsonb_agg(row_to_json(g)), jsonb_build_array()) INTO v_goals
  FROM (
    SELECT 
      fg.id,
      fg.title,
      fg.description,
      fg.category,
      fg.difficulty,
      fg.target_value,
      COALESCE(fg.current_value, 0) as current_value,
      fg.status,
      fg.reward_coins,
      COALESCE(fg.bonus_coins, 0) as bonus_coins,
      fg.expires_at
    FROM public.family_goals fg
    WHERE fg.family_id = v_family_id 
      AND fg.status = 'active'
      AND fg.expires_at > NOW()
    ORDER BY fg.expires_at ASC
    LIMIT 10
  ) g;

  -- 5. Get achievements (LIMITED to 6 latest)
  SELECT COALESCE(jsonb_agg(row_to_json(a)), jsonb_build_array()) INTO v_achievements
  FROM (
    SELECT 
      fa.id,
      fa.title,
      fa.description,
      fa.icon,
      fa.rarity,
      fa.unlocked_at
    FROM public.family_achievements fa
    WHERE fa.family_id = v_family_id
    ORDER BY fa.unlocked_at DESC NULLS LAST
    LIMIT 6
  ) a;

  -- 6. Get vault data
  SELECT COALESCE(jsonb_build_object(
    'total_coins', COALESCE(fv.total_coins, 0),
    'weekly_contribution', COALESCE(fv.weekly_contribution, 0),
    'streak_bonus', COALESCE(fv.streak_bonus, 0)
  ), jsonb_build_object('total_coins', 0, 'weekly_contribution', 0, 'streak_bonus', 0)) INTO v_vault
  FROM public.family_vault fv
  WHERE fv.family_id = v_family_id;

  -- 7. Get heartbeat data (using optimized query with indexes)
  v_heartbeat := public.get_family_heartbeat_json(v_family_id);

  -- 8. Get notifications (LIMITED to 5 latest unread)
  SELECT COALESCE(jsonb_agg(row_to_json(n)), jsonb_build_array()) INTO v_notifications
  FROM (
    SELECT 
      fn.id,
      fn.title,
      fn.message,
      fn.severity,
      fn.is_read,
      fn.created_at
    FROM public.family_notifications fn
    WHERE fn.family_id = v_family_id
      AND fn.is_read = false
    ORDER BY fn.created_at DESC
    LIMIT 5
  ) n;

  -- Build final result
  v_result := jsonb_build_object(
    'family', v_family,
    'members', v_members,
    'goals', v_goals,
    'achievements', v_achievements,
    'vault', v_vault,
    'heartbeat', COALESCE(v_heartbeat, jsonb_build_object(
      'health', 'unknown',
      'total_members', jsonb_array_length(v_members),
      'active_members', 0,
      'at_risk_members', 0,
      'goals_active', jsonb_array_length(v_goals),
      'goals_completed', 0,
      'current_streak', 0,
      'unread_notifications', jsonb_array_length(v_notifications)
    )),
    'notifications', v_notifications,
    'user_role', v_role
  );

  RETURN v_result;
END;
$$;

-- Create optimized heartbeat JSON function (helper for above)
CREATE OR REPLACE FUNCTION public.get_family_heartbeat_json(p_family_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_total_members INT;
  v_active_members INT;
  v_goals_active INT;
  v_goals_completed INT;
  v_unread_notif INT;
BEGIN
  -- Count total members (uses idx_family_members_family_id)
  SELECT COUNT(*) INTO v_total_members
  FROM public.family_members
  WHERE family_id = p_family_id;

  -- Count active members (last_active within 24 hours - needs index)
  SELECT COUNT(*) INTO v_active_members
  FROM public.family_members
  WHERE family_id = p_family_id
    AND last_active_at > NOW() - INTERVAL '24 hours';

  -- Count active goals
  SELECT COUNT(*) INTO v_goals_active
  FROM public.family_goals
  WHERE family_id = p_family_id
    AND status = 'active'
    AND expires_at > NOW();

  -- Count completed goals this week
  SELECT COUNT(*) INTO v_goals_completed
  FROM public.family_goals
  WHERE family_id = p_family_id
    AND status = 'completed'
    AND completed_at > NOW() - INTERVAL '7 days';

  -- Count unread notifications
  SELECT COUNT(*) INTO v_unread_notif
  FROM public.family_notifications
  WHERE family_id = p_family_id
    AND is_read = false;

  -- Determine health status
  DECLARE
    v_health TEXT;
    v_at_risk INT;
  BEGIN
    v_at_risk := v_total_members - v_active_members;
    
    IF v_total_members = 0 THEN
      v_health := 'unknown';
    ELSIF v_active_members::FLOAT / v_total_members >= 0.7 THEN
      v_health := 'thriving';
    ELSIF v_active_members::FLOAT / v_total_members >= 0.4 THEN
      v_health := 'stable';
    ELSE
      v_health := 'struggling';
    END IF;

    v_result := jsonb_build_object(
      'health', v_health,
      'total_members', v_total_members,
      'active_members', v_active_members,
      'at_risk_members', v_at_risk,
      'goals_active', v_goals_active,
      'goals_completed', v_goals_completed,
      'current_streak', 0, -- Calculate from vault if needed
      'unread_notifications', v_unread_notif
    );
  END;

  RETURN v_result;
END;
$$;

-- Create index on family_members.last_active_at for heartbeat queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_family_members_last_active 
ON public.family_members(last_active_at) 
WHERE last_active_at IS NOT NULL;

-- Create index on family_goals for heartbeat queries
CREATE INDEX IF NOT EXISTS idx_family_goals_status_expires 
ON public.family_goals(status, expires_at) 
WHERE status = 'active';

-- Create index on family_notifications for quick unread count
CREATE INDEX IF NOT EXISTS idx_family_notifications_unread 
ON public.family_notifications(family_id, is_read) 
WHERE is_read = false;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_family_home_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_family_home_json(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_family_heartbeat_json(UUID) TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION public.get_family_home_data(UUID) IS 'Aggregated family home data - returns family, members (10), goals (10), achievements (6), vault, heartbeat, and notifications (5) in a single call. Pass user_id to get their role and personalized data.';
