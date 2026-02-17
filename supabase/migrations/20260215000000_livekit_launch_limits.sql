-- Launch event limits and usage snapshot helpers

-- Log participant snapshots for internal monitoring
CREATE TABLE IF NOT EXISTS public.participant_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_participants integer NOT NULL,
  total_live_streams integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Reserve a viewer slot with hard cap enforcement
CREATE OR REPLACE FUNCTION public.reserve_stream_viewer_slot(
  p_stream_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_now timestamptz := now();
  v_recent_interval interval := interval '2 minutes';
  v_viewer_limit integer := 10;
  v_global_limit integer := 95;
  v_room_count integer := 0;
  v_global_count integer := 0;
  v_is_live boolean := false;
  v_existing boolean := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'auth_required');
  END IF;

  -- Serialize per-stream join checks to enforce hard cap
  PERFORM pg_advisory_xact_lock(hashtext(p_stream_id::text));

  SELECT (is_live AND status <> 'ended')
    INTO v_is_live
    FROM public.streams
   WHERE id = p_stream_id;

  IF v_is_live IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('success', false, 'reason', 'stream_ended');
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.stream_viewers
     WHERE stream_id = p_stream_id
       AND user_id = v_user_id
  ) INTO v_existing;

  SELECT COUNT(*)
    INTO v_room_count
    FROM public.stream_viewers
   WHERE stream_id = p_stream_id
     AND last_seen >= v_now - v_recent_interval;

  SELECT COUNT(*)
    INTO v_global_count
    FROM public.stream_viewers
   WHERE last_seen >= v_now - v_recent_interval;

  IF v_global_count >= v_global_limit AND NOT v_existing THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'global_limit',
      'current_count', v_room_count,
      'limit', v_viewer_limit,
      'global_count', v_global_count,
      'global_limit', v_global_limit
    );
  END IF;

  IF v_room_count >= v_viewer_limit AND NOT v_existing THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'room_full',
      'current_count', v_room_count,
      'limit', v_viewer_limit
    );
  END IF;

  INSERT INTO public.stream_viewers (stream_id, user_id, last_seen)
  VALUES (p_stream_id, v_user_id, v_now)
  ON CONFLICT (stream_id, user_id)
  DO UPDATE SET last_seen = EXCLUDED.last_seen;

  RETURN jsonb_build_object(
    'success', true,
    'current_count', v_room_count,
    'limit', v_viewer_limit,
    'global_count', v_global_count,
    'global_limit', v_global_limit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_stream_viewer_slot(uuid) TO anon, authenticated;

-- Participant snapshot for admin monitoring (optionally logged)
CREATE OR REPLACE FUNCTION public.get_livekit_participant_snapshot(
  p_log boolean DEFAULT false
)
RETURNS TABLE (
  snapshot_at timestamptz,
  total_participants integer,
  total_live_streams integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_recent_interval interval := interval '2 minutes';
  v_participants integer := 0;
  v_streams integer := 0;
BEGIN
  SELECT COUNT(*)
    INTO v_participants
    FROM public.stream_viewers
   WHERE last_seen >= v_now - v_recent_interval;

  SELECT COUNT(*)
    INTO v_streams
    FROM public.streams
   WHERE is_live = true
     AND status <> 'ended';

  IF p_log THEN
    INSERT INTO public.participant_snapshots (total_participants, total_live_streams)
    VALUES (v_participants, v_streams);
  END IF;

  snapshot_at := v_now;
  total_participants := v_participants;
  total_live_streams := v_streams;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_livekit_participant_snapshot(boolean) TO authenticated;

-- Rough participant-minutes usage snapshot for launch session
CREATE OR REPLACE FUNCTION public.get_launch_usage_snapshot(
  p_since timestamptz DEFAULT NULL
)
RETURNS TABLE (
  minutes_used bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := COALESCE(p_since, date_trunc('day', now()));
BEGIN
  RETURN QUERY
  SELECT COALESCE(SUM(
    GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (COALESCE(ended_at, now()) - started_at)) / 60))
    * COALESCE(current_viewers, viewer_count, 0)
  )::bigint, 0)
  FROM public.streams
  WHERE started_at IS NOT NULL
    AND started_at >= v_since;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_launch_usage_snapshot(timestamptz) TO authenticated;

-- Stream gift totals and leaderboard helpers
CREATE OR REPLACE FUNCTION public.get_stream_gift_total(
  p_stream_id uuid
)
RETURNS TABLE (
  total_coins bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT COALESCE(SUM(amount), 0)::bigint
  FROM public.stream_gifts
  WHERE stream_id = p_stream_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stream_gift_total(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_stream_gift_leaderboard(
  p_stream_id uuid,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  sender_id uuid,
  total_coins bigint,
  gift_count bigint,
  last_gift_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sender_id,
    COALESCE(SUM(amount), 0)::bigint AS total_coins,
    COUNT(*)::bigint AS gift_count,
    MAX(created_at) AS last_gift_at
  FROM public.stream_gifts
  WHERE stream_id = p_stream_id
  GROUP BY sender_id
  ORDER BY total_coins DESC, last_gift_at DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stream_gift_leaderboard(uuid, integer) TO anon, authenticated;
