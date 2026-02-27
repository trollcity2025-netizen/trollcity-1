-- ============================================================
-- BATTLE SYSTEM MIGRATIONS - Run this file to fix battle "Bad Request" errors
-- ============================================================

-- 1. Create battles table (from 20250202130000_battles.sql)
CREATE TABLE IF NOT EXISTS public.battles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_stream_id UUID REFERENCES public.streams(id) NOT NULL,
  opponent_stream_id UUID REFERENCES public.streams(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended')),
  winner_stream_id UUID REFERENCES public.streams(id),
  score_challenger INTEGER DEFAULT 0,
  score_opponent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- Add battle_id to streams if not exists
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS battle_id UUID REFERENCES public.battles(id);

-- 2. RPC to create a battle challenge
CREATE OR REPLACE FUNCTION public.create_battle_challenge(
  p_challenger_id UUID,
  p_opponent_id UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_battle_id UUID;
BEGIN
  INSERT INTO public.battles (challenger_stream_id, opponent_stream_id)
  VALUES (p_challenger_id, p_opponent_id)
  RETURNING id INTO v_battle_id;
  
  RETURN v_battle_id;
END;
$$;

-- 3. RPC to accept battle
CREATE OR REPLACE FUNCTION public.accept_battle(
  p_battle_id UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_battle RECORD;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
  
  IF v_battle IS NULL THEN
    RAISE EXCEPTION 'Battle not found';
  END IF;

  UPDATE public.battles 
  SET status = 'active', started_at = now() 
  WHERE id = p_battle_id;

  -- Link both streams to this battle
  UPDATE public.streams 
  SET battle_id = p_battle_id, is_battle = true
  WHERE id IN (v_battle.challenger_stream_id, v_battle.opponent_stream_id);

  RETURN TRUE;
END;
$$;

-- 4. End battle function
CREATE OR REPLACE FUNCTION public.end_battle(
  p_battle_id UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_battle RECORD;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
  
  IF v_battle IS NULL THEN
    RAISE EXCEPTION 'Battle not found';
  END IF;

  UPDATE public.battles 
  SET status = 'ended', ended_at = now() 
  WHERE id = p_battle_id;

  -- Unlink streams
  UPDATE public.streams 
  SET battle_id = NULL, is_battle = false
  WHERE id IN (v_battle.challenger_stream_id, v_battle.opponent_stream_id);

  RETURN TRUE;
END;
$$;

-- 5. Find match candidate function
CREATE OR REPLACE FUNCTION find_match_candidate(
    p_stream_id UUID
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    title TEXT,
    viewer_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_recent_opponent_ids UUID[];
    v_busy_stream_ids UUID[];
BEGIN
    -- Get IDs of recent opponents (last 10 battles)
    SELECT ARRAY_AGG(
        CASE 
            WHEN challenger_stream_id = p_stream_id THEN opponent_stream_id
            ELSE challenger_stream_id
        END
    )
    INTO v_recent_opponent_ids
    FROM (
        SELECT challenger_stream_id, opponent_stream_id
        FROM battles
        WHERE (challenger_stream_id = p_stream_id OR opponent_stream_id = p_stream_id)
        AND status IN ('ended', 'active')
        ORDER BY created_at DESC
        LIMIT 10
    ) recent;

    -- Get IDs of streams currently in a pending or active battle
    SELECT ARRAY_AGG(
        CASE 
            WHEN challenger_stream_id IS NOT NULL THEN challenger_stream_id
            ELSE opponent_stream_id
        END
    )
    INTO v_busy_stream_ids
    FROM battles
    WHERE status IN ('pending', 'active');

    -- Return a random stream meeting criteria
    RETURN QUERY
    SELECT s.id::UUID, s.user_id::UUID, s.title::TEXT, s.viewer_count::INTEGER
    FROM streams s
    WHERE s.is_live = TRUE
      AND s.is_battle = FALSE
      AND s.id != p_stream_id
      AND (v_recent_opponent_ids IS NULL OR NOT (s.id = ANY(v_recent_opponent_ids)))
      AND (v_busy_stream_ids IS NULL OR NOT (s.id = ANY(v_busy_stream_ids)))
    ORDER BY RANDOM()
    LIMIT 1;
END;
$$;

-- 6. Create battle_skips table if not exists
CREATE TABLE IF NOT EXISTS public.battle_skips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    skip_date DATE NOT NULL DEFAULT CURRENT_DATE,
    skips_used INTEGER DEFAULT 0,
    last_skip_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_battle_skips_user_date ON public.battle_skips(user_id, skip_date);

-- 7. Record battle skip function
CREATE OR REPLACE FUNCTION public.record_battle_skip(
    p_user_id UUID,
    p_free_limit INTEGER DEFAULT 5,
    p_cost INTEGER DEFAULT 50
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_skips RECORD;
    v_balance BIGINT;
    v_charged BOOLEAN := FALSE;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    SELECT * INTO v_skips
    FROM public.battle_skips
    WHERE user_id = p_user_id AND skip_date = CURRENT_DATE;

    IF v_skips IS NULL THEN
        INSERT INTO public.battle_skips (user_id, skips_used)
        VALUES (p_user_id, 0)
        RETURNING * INTO v_skips;
    END IF;

    IF v_skips.skips_used >= p_free_limit THEN
        SELECT troll_coins INTO v_balance
        FROM public.user_profiles
        WHERE id = p_user_id
        FOR UPDATE;

        IF v_balance IS NULL OR v_balance < p_cost THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient Troll Coins');
        END IF;

        UPDATE public.user_profiles
        SET troll_coins = troll_coins - p_cost
        WHERE id = p_user_id;

        v_charged := TRUE;
    END IF;

    UPDATE public.battle_skips
    SET skips_used = skips_used + 1,
        last_skip_time = NOW()
    WHERE id = v_skips.id;

    RETURN jsonb_build_object(
        'success', true,
        'skips_used', v_skips.skips_used + 1,
        'charged', v_charged,
        'cost', CASE WHEN v_charged THEN p_cost ELSE 0 END
    );
END;
$$;

-- 8. Cancel battle challenge function
CREATE OR REPLACE FUNCTION public.cancel_battle_challenge(
    p_battle_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle RECORD;
BEGIN
    SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;

    IF v_battle IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Battle not found');
    END IF;

    -- Only allow challenger to cancel
    -- Get stream user_id to check ownership
    IF NOT EXISTS (
        SELECT 1 FROM streams 
        WHERE id = v_battle.challenger_stream_id 
        AND user_id = p_user_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized to cancel this battle');
    END IF;

    DELETE FROM public.battles WHERE id = p_battle_id AND status = 'pending';

    RETURN jsonb_build_object('success', true, 'message', 'Battle cancelled');
END;
$$;

-- 9. Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.create_battle_challenge(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_battle(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_battle(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION find_match_candidate(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_battle_skip(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_battle_challenge(UUID, UUID) TO authenticated;

-- 10. Grant table permissions
GRANT ALL ON public.battles TO authenticated;
GRANT ALL ON public.battle_skips TO authenticated;

-- ============================================================
-- END OF BATTLE MIGRATIONS
-- ============================================================
