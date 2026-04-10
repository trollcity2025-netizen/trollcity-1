-- ✅ STRICT BATTLE HANDSHAKE ENFORCEMENT
-- ✅ BATTLE NEVER STARTS FROM ONE CLICK
-- ✅ BACKEND ONLY AUTHORITY

-- Add missing columns first
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS team_a_stream_id TEXT;
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS team_b_stream_id TEXT;
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS team_a_captain UUID;
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS team_b_captain UUID;
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS team_a_score INTEGER DEFAULT 0;
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS team_b_score INTEGER DEFAULT 0;

-- Add looking_for_battle column to streams (if not exists)
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS looking_for_battle BOOLEAN DEFAULT false;
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS looking_for_battle_since TIMESTAMPTZ;

-- Add unique constraint to prevent duplicate pending battles per stream
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_battle ON public.battles (
  GREATEST(team_a_stream_id, team_b_stream_id),
  LEAST(team_a_stream_id, team_b_stream_id)
) WHERE status IN ('waiting_for_opponent', 'pending_locked');

-- ✅ ENFORCE STATE TRANSITION RULES
CREATE OR REPLACE FUNCTION public.enforce_battle_state_rules()
RETURNS TRIGGER AS $$
BEGIN
  -- ❌ PREVENT SINGLE SIDE BATTLE START
  IF NEW.status = 'active' THEN
    IF OLD.team_b_captain IS NULL OR NEW.team_b_captain IS NULL THEN
      RAISE EXCEPTION 'Cannot activate battle: team_b not confirmed';
    END IF;
    IF OLD.team_a_captain IS NULL OR NEW.team_a_captain IS NULL THEN
      RAISE EXCEPTION 'Cannot activate battle: team_a not confirmed';
    END IF;
    IF NEW.scheduled_start_at IS NULL THEN
      RAISE EXCEPTION 'Cannot activate battle: no scheduled start time set';
    END IF;
    IF NOW() < NEW.scheduled_start_at THEN
      RAISE EXCEPTION 'Cannot activate battle: scheduled start time not reached';
    END IF;
  END IF;

  -- ❌ PREVENT DIRECT JUMP FROM WAITING TO ACTIVE
  IF OLD.status = 'waiting_for_opponent' AND NEW.status = 'active' THEN
    RAISE EXCEPTION 'Invalid state transition: must go through pending_locked';
  END IF;

  -- ✅ ALLOW ONLY CORRECT TRANSITIONS
  IF NOT (
    (OLD.status = 'idle' AND NEW.status = 'waiting_for_opponent') OR
    (OLD.status = 'waiting_for_opponent' AND NEW.status = 'pending_locked') OR
    (OLD.status = 'pending_locked' AND NEW.status = 'countdown') OR
    (OLD.status = 'countdown' AND NEW.status = 'active') OR
    (NEW.status IN ('ended', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid battle state transition';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_battle_state_rules ON public.battles;
CREATE TRIGGER trigger_enforce_battle_state_rules
BEFORE UPDATE ON public.battles
FOR EACH ROW EXECUTE FUNCTION public.enforce_battle_state_rules();

-- ✅ AUTOMATIC SCHEDULED START
CREATE OR REPLACE FUNCTION public.process_scheduled_battles()
RETURNS void AS $$
BEGIN
  UPDATE public.battles
  SET status = 'active',
      started_at = NOW(),
      ends_at = NOW() + INTERVAL '180 seconds'
  WHERE status = 'countdown'
    AND scheduled_start_at <= NOW()
    AND started_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ✅ FIX CAPTAIN CLICK LOGIC - SIMPLE STREAMS UPDATE
CREATE OR REPLACE FUNCTION public.captain_click_battle(p_stream_id TEXT, p_captain_id UUID)
RETURNS JSONB AS $$
DECLARE
  active_seats UUID[];
  new_battle_id TEXT;
  stream_is_active BOOLEAN;
  waiting_stream RECORD;
BEGIN
  -- Get current active seats from this stream
  SELECT ARRAY_AGG(user_id) INTO active_seats
  FROM public.stream_seats
  WHERE stream_id = p_stream_id
    AND is_active = true
    AND user_id IS NOT NULL;

  -- Check if this stream is already looking for battle
  SELECT is_live INTO stream_is_active
  FROM public.streams WHERE id = p_stream_id;

  -- If not live, can't start battle
  IF NOT stream_is_active OR stream_is_active IS NULL THEN
    RAISE EXCEPTION 'Stream is not live';
  END IF;

  -- Check if THIS stream already has a waiting battle
  IF EXISTS (
    SELECT 1 FROM public.battles
    WHERE team_a_stream_id = p_stream_id
      AND status = 'waiting_for_opponent'
  ) THEN
    RETURN jsonb_build_object(
      'status', 'already_waiting',
      'message', 'Already waiting for opponent...'
    );
  END IF;

  -- Look for OTHER stream that is explicitly LOOKING FOR BATTLE
  SELECT * INTO waiting_stream
  FROM public.streams
  WHERE is_live = true
    AND looking_for_battle = true
    AND id != p_stream_id
    AND user_id != p_captain_id
  ORDER BY looking_for_battle_since ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    -- ✅ OPPONENT EXPLICITLY CLICKED BATTLE - LOCK AND START
    -- Clear their looking flag first
    UPDATE public.streams SET
      looking_for_battle = false,
      looking_for_battle_since = NULL
    WHERE id = waiting_stream.id;

    -- Create the matched battle
    INSERT INTO public.battles (
      team_a_stream_id,
      team_a_captain,
      team_a_member_ids,
      team_b_stream_id,
      team_b_captain,
      team_b_member_ids,
      status,
      locked_at,
      scheduled_start_at
    ) VALUES (
      waiting_stream.id,
      waiting_stream.user_id,
      COALESCE((SELECT ARRAY_AGG(user_id) FROM public.stream_seats WHERE stream_id = waiting_stream.id AND is_active = true), ARRAY[]::UUID[]),
      p_stream_id,
      p_captain_id,
      active_seats,
      'pending_locked',
      NOW(),
      NOW() + INTERVAL '8 seconds'
    ) RETURNING id INTO new_battle_id;

    -- ✅ MARK BOTH STREAMS WITH BATTLE ID
    UPDATE public.streams SET
      battle_id = new_battle_id,
      is_battle = true,
      looking_for_battle = false,
      looking_for_battle_since = NULL
    WHERE id IN (waiting_stream.id, p_stream_id);

    RETURN jsonb_build_object(
      'status', 'matched',
      'battle_id', new_battle_id,
      'countdown_started', true,
      'scheduled_start_at', NOW() + INTERVAL '8 seconds'
    );
  END IF;

  -- ❌ NO ONE LOOKING - Mark THIS stream as looking for battle
  UPDATE public.streams SET
    looking_for_battle = true,
    looking_for_battle_since = NOW()
  WHERE id = p_stream_id;

  -- Create waiting battle record
  INSERT INTO public.battles (
    team_a_stream_id,
    team_a_captain,
    team_a_member_ids,
    status
  ) VALUES (
    p_stream_id,
    p_captain_id,
    active_seats,
    'waiting_for_opponent'
  ) RETURNING id INTO new_battle_id;

  RETURN jsonb_build_object(
    'status', 'waiting_for_opponent',
    'battle_id', new_battle_id,
    'message', 'Waiting for opponent to click Battle...'
  );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;