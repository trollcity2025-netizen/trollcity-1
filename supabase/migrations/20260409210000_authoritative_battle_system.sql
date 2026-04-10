-- ✅ AUTHORITATIVE 5V5 BATTLE SYSTEM
-- ✅ SINGLE SOURCE OF TRUTH
-- ✅ NO CLIENT AUTHORITY
-- ✅ PERFECT SYNC

-- Add proper battle schema
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS team_a_member_ids UUID[] DEFAULT '{}';
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS team_b_member_ids UUID[] DEFAULT '{}';
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS team_a_stream_id TEXT;
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS team_b_stream_id TEXT;
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Stream seat tracking for auto roster collection
CREATE TABLE IF NOT EXISTS public.stream_seats (
  stream_id TEXT REFERENCES streams(id) ON DELETE CASCADE,
  seat_index SMALLINT NOT NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (stream_id, seat_index)
);

CREATE INDEX IF NOT EXISTS idx_stream_seats_active ON public.stream_seats(stream_id, is_active) WHERE is_active = true;

-- ✅ STATE MACHINE
CREATE TYPE battle_status AS ENUM (
  'idle',
  'waiting_for_opponent',
  'pending_locked',
  'countdown',
  'active',
  'ended',
  'cancelled'
);

ALTER TABLE public.battles ALTER COLUMN status TYPE battle_status USING status::battle_status;

-- ✅ AUTOMATIC BATTLE START TRIGGER
CREATE OR REPLACE FUNCTION public.battle_scheduled_start()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'countdown' 
    AND NEW.scheduled_start_at <= NOW() 
    AND OLD.status != 'active' THEN
    NEW.status := 'active';
    NEW.started_at := NOW();
    NEW.ends_at := NOW() + INTERVAL '180 seconds';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_battle_scheduled_start ON public.battles;
CREATE TRIGGER trigger_battle_scheduled_start
BEFORE UPDATE ON public.battles
FOR EACH ROW EXECUTE FUNCTION public.battle_scheduled_start();

-- ✅ AUTHORITATIVE CAPTAIN CLICK HANDLER
CREATE OR REPLACE FUNCTION public.captain_click_battle(p_stream_id TEXT, p_captain_id UUID)
RETURNS JSONB AS $$
DECLARE
  existing_pending RECORD;
  opponent_stream RECORD;
  active_seats UUID[];
  new_battle_id TEXT;
BEGIN
  -- Step 1: Get currently active seated guests on this stream
  SELECT ARRAY_AGG(user_id) INTO active_seats
  FROM public.stream_seats
  WHERE stream_id = p_stream_id
    AND is_active = true
    AND user_id IS NOT NULL;

  -- Step 2: Look for waiting opponent
  SELECT * INTO existing_pending
  FROM public.battles
  WHERE status = 'waiting_for_opponent'
    AND team_b_stream_id IS NULL
    AND team_a_captain != p_captain_id
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    -- ✅ OPPONENT FOUND
    UPDATE public.battles SET
      team_b_stream_id = p_stream_id,
      team_b_captain = p_captain_id,
      team_b_member_ids = active_seats,
      status = 'pending_locked',
      locked_at = NOW(),
      scheduled_start_at = NOW() + INTERVAL '10 seconds'
    WHERE id = existing_pending.id
    RETURNING id INTO new_battle_id;

    -- ✅ MARK BOTH STREAMS AS IN BATTLE
    UPDATE public.streams SET
      battle_id = new_battle_id,
      is_battle = true
    WHERE id IN (existing_pending.team_a_stream_id, p_stream_id);

    RETURN jsonb_build_object(
      'status', 'matched',
      'battle_id', new_battle_id,
      'opponent_found', true
    );
  END IF;

  -- ❌ NO OPPONENT FOUND - CREATE WAITING BATTLE
  INSERT INTO public.battles (
    team_a_stream_id,
    team_a_captain,
    team_a_member_ids,
    status,
    created_at
  ) VALUES (
    p_stream_id,
    p_captain_id,
    active_seats,
    'waiting_for_opponent',
    NOW()
  ) RETURNING id INTO new_battle_id;

  RETURN jsonb_build_object(
    'status', 'waiting_for_opponent',
    'battle_id', new_battle_id,
    'message', 'Waiting for opponent...'
  );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.captain_click_battle(TEXT, UUID) TO authenticated;

-- ✅ AUTO EXPIRE STALE WAITING BATTLES
CREATE OR REPLACE FUNCTION public.expire_stale_battles()
RETURNS void AS $$
BEGIN
  UPDATE public.battles
  SET status = 'cancelled'
  WHERE status = 'waiting_for_opponent'
    AND created_at < NOW() - INTERVAL '60 seconds';
END;
$$ LANGUAGE plpgsql;