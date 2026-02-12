-- Fix accept_battle to snapshot top 3 guests by total gift value
-- This replaces the previous snapshot logic to only take top 3 guests ranked by gifts received

CREATE OR REPLACE FUNCTION public.accept_battle(p_battle_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_battle RECORD;
    v_challenger_stream RECORD;
    v_opponent_stream RECORD;
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

    -- 3. Lock the streams
    SELECT * INTO v_challenger_stream FROM public.streams WHERE id = v_battle.challenger_stream_id FOR UPDATE;
    SELECT * INTO v_opponent_stream FROM public.streams WHERE id = v_battle.opponent_stream_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'One or both streams not found';
    END IF;

    -- 4. Transition battle to 'active'
    UPDATE public.battles
    SET 
        status = 'active',
        started_at = now()
    WHERE id = p_battle_id;

    -- 5. Set battle_id on both streams
    UPDATE public.streams SET battle_id = p_battle_id WHERE id = v_battle.challenger_stream_id;
    UPDATE public.streams SET battle_id = p_battle_id WHERE id = v_battle.opponent_stream_id;

    -- 6. Snapshot Battle Hosts
    INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id)
    VALUES 
        (p_battle_id, v_challenger_stream.user_id, 'challenger', 'host', v_battle.challenger_stream_id),
        (p_battle_id, v_opponent_stream.user_id, 'opponent', 'host', v_battle.opponent_stream_id)
    ON CONFLICT (battle_id, user_id) DO NOTHING;

    -- 7. Snapshot Top 3 Stage Guests (Challenger) by gift value
    -- Calculate total gifts received per guest in this stream
    INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id, seat_index)
    SELECT 
        p_battle_id,
        sss.user_id,
        'challenger',
        'stage',
        v_battle.challenger_stream_id,
        sss.seat_index
    FROM public.stream_seat_sessions sss
    LEFT JOIN (
        SELECT receiver_id, SUM(amount) as total_gifts
        FROM public.gift_ledger
        WHERE stream_id = v_battle.challenger_stream_id 
          AND status = 'processed'
        GROUP BY receiver_id
    ) gl ON gl.receiver_id = sss.user_id
    WHERE sss.stream_id = v_battle.challenger_stream_id 
      AND sss.status = 'active' 
      AND sss.user_id IS NOT NULL
    ORDER BY COALESCE(gl.total_gifts, 0) DESC, sss.joined_at ASC
    LIMIT 3
    ON CONFLICT (battle_id, user_id) DO NOTHING;

    -- 8. Snapshot Top 3 Stage Guests (Opponent) by gift value
    INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id, seat_index)
    SELECT 
        p_battle_id,
        sss.user_id,
        'opponent',
        'stage',
        v_battle.opponent_stream_id,
        sss.seat_index
    FROM public.stream_seat_sessions sss
    LEFT JOIN (
        SELECT receiver_id, SUM(amount) as total_gifts
        FROM public.gift_ledger
        WHERE stream_id = v_battle.opponent_stream_id 
          AND status = 'processed'
        GROUP BY receiver_id
    ) gl ON gl.receiver_id = sss.user_id
    WHERE sss.stream_id = v_battle.opponent_stream_id 
      AND sss.status = 'active' 
      AND sss.user_id IS NOT NULL
    ORDER BY COALESCE(gl.total_gifts, 0) DESC, sss.joined_at ASC
    LIMIT 3
    ON CONFLICT (battle_id, user_id) DO NOTHING;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
