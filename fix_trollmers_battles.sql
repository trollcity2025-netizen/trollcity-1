-- Fix Trollmers Head-to-Head Battles
-- Run these SQL commands directly in Supabase SQL Editor

-- FIRST: Add missing ended_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'battles' 
        AND column_name = 'ended_at'
    ) THEN
        ALTER TABLE public.battles ADD COLUMN ended_at TIMESTAMPTZ;
    END IF;
END $$;

-- CLEANUP: Cancel any pending battles where either stream is no longer live
UPDATE public.battles 
SET status = 'cancelled', 
    ended_at = NOW()
WHERE status = 'pending'
  AND (challenger_stream_id NOT IN (SELECT id FROM public.streams WHERE status = 'live' AND is_live = TRUE)
    OR opponent_stream_id NOT IN (SELECT id FROM public.streams WHERE status = 'live' AND is_live = TRUE));

-- Show how many battles were cleaned up
-- SELECT 'Cancelled ' || COUNT(*) || ' pending battles with inactive streams' as cleanup_result FROM public.battles WHERE status = 'cancelled' AND ended_at > NOW() - INTERVAL '1 minute';

-- Fix 1: Update is_trollmers_eligible to require only 1 follower instead of 100
CREATE OR REPLACE FUNCTION public.is_trollmers_eligible(
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_followers_count INTEGER;
    v_user_role TEXT;
BEGIN
    -- Check if user is admin (bypass follower requirement)
    SELECT role INTO v_user_role
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF v_user_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Check follower count for non-admins
    SELECT COUNT(*)
    INTO v_followers_count
    FROM public.user_follows
    WHERE following_id = p_user_id;

    -- Changed from 100 to 1 follower
    RETURN v_followers_count >= 1;
END;
$$;

-- Fix 2: Update accept_battle to set is_battle = true on both streams
CREATE OR REPLACE FUNCTION public.accept_battle(p_battle_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle RECORD;
    v_challenger_stream RECORD;
    v_opponent_stream RECORD;
    v_challenger_found BOOLEAN := FALSE;
    v_opponent_found BOOLEAN := FALSE;
BEGIN
    -- 1. Lock the battle row
    SELECT * INTO v_battle
    FROM public.battles
    WHERE id = p_battle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Battle not found: %', p_battle_id;
    END IF;

    -- 2. Ensure the battle is still 'pending'
    IF v_battle.status != 'pending' THEN
        RAISE EXCEPTION 'Battle is not pending (status: %)', v_battle.status;
    END IF;

    -- 3. Lock the streams and check individually if each exists
    SELECT * INTO v_challenger_stream FROM public.streams WHERE id = v_battle.challenger_stream_id FOR UPDATE;
    v_challenger_found := FOUND;
    
    SELECT * INTO v_opponent_stream FROM public.streams WHERE id = v_battle.opponent_stream_id FOR UPDATE;
    v_opponent_found := FOUND;

    -- Check if both streams were found
    IF NOT v_challenger_found THEN
        RAISE EXCEPTION 'Challenger stream not found or not live: %', v_battle.challenger_stream_id;
    END IF;
    
    IF NOT v_opponent_found THEN
        RAISE EXCEPTION 'Opponent stream not found or not live: %', v_battle.opponent_stream_id;
    END IF;

    -- 3b. Ensure both streams are still live
    IF v_challenger_stream.status != 'live' OR v_challenger_stream.is_live != TRUE THEN
        RAISE EXCEPTION 'Challenger stream is not live';
    END IF;
    
    IF v_opponent_stream.status != 'live' OR v_opponent_stream.is_live != TRUE THEN
        RAISE EXCEPTION 'Opponent stream is not live';
    END IF;

    -- 4. Transition battle to 'active'
    UPDATE public.battles
    SET
        status = 'active',
        started_at = now()
    WHERE id = p_battle_id;

    -- 5. Set battle_id AND is_battle on both streams (FIXED)
    UPDATE public.streams SET battle_id = p_battle_id, is_battle = true WHERE id = v_battle.challenger_stream_id;
    UPDATE public.streams SET battle_id = p_battle_id, is_battle = true WHERE id = v_battle.opponent_stream_id;

    -- Rest of the function continues unchanged...
    -- 6. Snapshot Battle Hosts
    INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id)
    VALUES
        (p_battle_id, v_challenger_stream.user_id, 'challenger', 'host', v_battle.challenger_stream_id),
        (p_battle_id, v_opponent_stream.user_id, 'opponent', 'host', v_battle.opponent_stream_id)
    ON CONFLICT (battle_id, user_id) DO NOTHING;

    RETURN TRUE;
END;
$$;

-- Fix 3: Update find_match_candidate to remove camera_ready requirement for Trollmers
-- (This is already fixed in the source files, the migration will handle it)

-- Fix 4: Enhanced create_battle_challenge with stream validation
CREATE OR REPLACE FUNCTION public.create_battle_challenge(
  p_challenger_id UUID,
  p_opponent_id UUID
) RETURNS UUID AS $$
DECLARE
  v_battle_id UUID;
  v_challenger_kind TEXT;
  v_opponent_kind TEXT;
  v_battle_type TEXT := 'standard';
  v_challenger_user_id UUID;
  v_opponent_user_id UUID;
  v_challenger_stream RECORD;
  v_opponent_stream RECORD;
  v_tournament_battle_id UUID;
BEGIN
  -- Validate both streams exist and are live BEFORE creating battle
  SELECT * INTO v_challenger_stream 
  FROM public.streams 
  WHERE id = p_challenger_id 
    AND status = 'live' 
    AND is_live = TRUE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenger stream not found or not live: %', p_challenger_id;
  END IF;
  
  SELECT * INTO v_opponent_stream 
  FROM public.streams 
  WHERE id = p_opponent_id 
    AND status = 'live' 
    AND is_live = TRUE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opponent stream not found or not live: %', p_opponent_id;
  END IF;

  -- Get stream kinds and user IDs
  v_challenger_kind := v_challenger_stream.stream_kind;
  v_challenger_user_id := v_challenger_stream.user_id;
  v_opponent_kind := v_opponent_stream.stream_kind;
  v_opponent_user_id := v_opponent_stream.user_id;

  IF COALESCE(v_challenger_kind, 'regular') = 'trollmers'
     AND COALESCE(v_opponent_kind, 'regular') = 'trollmers' THEN
    v_battle_type := 'trollmers';
  END IF;

  INSERT INTO public.battles (challenger_stream_id, opponent_stream_id, battle_type)
  VALUES (p_challenger_id, p_opponent_id, v_battle_type)
  RETURNING id INTO v_battle_id;

  -- Auto-link to tournament if both participants are in pending tournament match
  IF v_battle_type = 'trollmers' THEN
    SELECT tb.id INTO v_tournament_battle_id
    FROM public.trollmers_tournament_battles tb
    JOIN public.trollmers_monthly_tournaments t ON t.id = tb.tournament_id
    WHERE t.status = 'active'
      AND tb.status = 'pending'
      AND (
        (tb.participant1_id = v_challenger_user_id AND tb.participant2_id = v_opponent_user_id)
        OR
        (tb.participant1_id = v_opponent_user_id AND tb.participant2_id = v_challenger_user_id)
      )
    LIMIT 1;

    IF v_tournament_battle_id IS NOT NULL THEN
      UPDATE public.trollmers_tournament_battles
      SET battle_id = v_battle_id,
          status = 'active'
      WHERE id = v_tournament_battle_id;
    END IF;
  END IF;

  RETURN v_battle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
