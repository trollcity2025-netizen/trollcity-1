-- Battle skip/leave enhancements

-- Record a battle skip with daily limits and optional coin cost
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

GRANT EXECUTE ON FUNCTION public.record_battle_skip(UUID, INTEGER, INTEGER) TO authenticated;

-- Cancel a pending battle challenge
CREATE OR REPLACE FUNCTION public.cancel_battle_challenge(
    p_battle_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle RECORD;
    v_challenger_owner UUID;
    v_opponent_owner UUID;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    SELECT * INTO v_battle
    FROM public.battles
    WHERE id = p_battle_id;

    IF v_battle IS NULL OR v_battle.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Battle not pending');
    END IF;

    SELECT user_id INTO v_challenger_owner FROM public.streams WHERE id = v_battle.challenger_stream_id;
    SELECT user_id INTO v_opponent_owner FROM public.streams WHERE id = v_battle.opponent_stream_id;

    IF p_user_id IS DISTINCT FROM v_challenger_owner AND p_user_id IS DISTINCT FROM v_opponent_owner THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not a participant');
    END IF;

    UPDATE public.battles
    SET status = 'ended', ended_at = NOW()
    WHERE id = p_battle_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_battle_challenge(UUID, UUID) TO authenticated;

-- Leave an active battle and forfeit the win to the other broadcaster
CREATE OR REPLACE FUNCTION public.leave_battle(
    p_battle_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle RECORD;
    v_challenger_owner UUID;
    v_opponent_owner UUID;
    v_winner_stream_id UUID;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    SELECT * INTO v_battle
    FROM public.battles
    WHERE id = p_battle_id;

    IF v_battle IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Battle not found');
    END IF;

    SELECT user_id INTO v_challenger_owner FROM public.streams WHERE id = v_battle.challenger_stream_id;
    SELECT user_id INTO v_opponent_owner FROM public.streams WHERE id = v_battle.opponent_stream_id;

    IF p_user_id = v_challenger_owner THEN
        v_winner_stream_id := v_battle.opponent_stream_id;
    ELSIF p_user_id = v_opponent_owner THEN
        v_winner_stream_id := v_battle.challenger_stream_id;
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Not a participant');
    END IF;

    UPDATE public.battles
    SET status = 'ended', ended_at = NOW()
    WHERE id = p_battle_id;

    IF v_winner_stream_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'battles' AND column_name = 'winner_id'
        ) THEN
            EXECUTE 'UPDATE public.battles SET winner_id = $1 WHERE id = $2'
            USING v_winner_stream_id, p_battle_id;
        ELSIF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'battles' AND column_name = 'winner_stream_id'
        ) THEN
            EXECUTE 'UPDATE public.battles SET winner_stream_id = $1 WHERE id = $2'
            USING v_winner_stream_id, p_battle_id;
        END IF;
    END IF;

    UPDATE public.streams
    SET battle_id = NULL
    WHERE battle_id = p_battle_id;

    RETURN jsonb_build_object('success', true, 'winner_stream_id', v_winner_stream_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_battle(UUID, UUID) TO authenticated;

-- Update troll battle skip logic with 5 free skips, then 50 coin cost
CREATE OR REPLACE FUNCTION public.skip_opponent(p_user_id UUID, p_battle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle JSONB;
    v_skips RECORD;
    v_cost INTEGER := 50;
    v_free_limit INTEGER := 5;
    v_opponent_id UUID;
    v_balance BIGINT;
    v_charged BOOLEAN := FALSE;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RETURN jsonb_build_object('error', 'Unauthorized');
    END IF;

    SELECT to_jsonb(t) INTO v_battle FROM public.troll_battles t WHERE id = p_battle_id;
    IF v_battle IS NULL OR (v_battle->>'status') <> 'pending' THEN
        RETURN jsonb_build_object('error', 'Invalid battle');
    END IF;

    IF v_battle ? 'host_id' THEN
        IF (v_battle->>'host_id')::UUID = p_user_id THEN
            v_opponent_id := (v_battle->>'challenger_id')::UUID;
        ELSIF (v_battle->>'challenger_id')::UUID = p_user_id THEN
            v_opponent_id := (v_battle->>'host_id')::UUID;
        ELSE
            RETURN jsonb_build_object('error', 'Not a participant');
        END IF;
    ELSE
        IF (v_battle->>'player1_id')::UUID = p_user_id THEN
            v_opponent_id := (v_battle->>'player2_id')::UUID;
        ELSIF (v_battle->>'player2_id')::UUID = p_user_id THEN
            v_opponent_id := (v_battle->>'player1_id')::UUID;
        ELSE
            RETURN jsonb_build_object('error', 'Not a participant');
        END IF;
    END IF;

    SELECT * INTO v_skips FROM public.battle_skips
    WHERE user_id = p_user_id AND skip_date = CURRENT_DATE;

    IF v_skips IS NULL THEN
        INSERT INTO public.battle_skips (user_id, skips_used) VALUES (p_user_id, 0)
        RETURNING * INTO v_skips;
    END IF;

    IF v_skips.skips_used >= v_free_limit THEN
        SELECT troll_coins INTO v_balance
        FROM public.user_profiles
        WHERE id = p_user_id
        FOR UPDATE;

        IF v_balance IS NULL OR v_balance < v_cost THEN
            RETURN jsonb_build_object('error', 'Insufficient Troll Coins');
        END IF;

        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_cost
        WHERE id = p_user_id;

        v_charged := TRUE;
    END IF;

    UPDATE public.battle_skips
    SET skips_used = skips_used + 1, last_skip_time = NOW()
    WHERE id = v_skips.id;

    UPDATE public.troll_battles
    SET status = 'cancelled'
    WHERE id = p_battle_id;

    INSERT INTO public.battle_queue (user_id) VALUES (v_opponent_id) ON CONFLICT DO NOTHING;

    PERFORM public.find_opponent(p_user_id);

    RETURN jsonb_build_object(
        'success', true,
        'skips_used', v_skips.skips_used + 1,
        'charged', v_charged,
        'cost', CASE WHEN v_charged THEN v_cost ELSE 0 END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.skip_opponent(UUID, UUID) TO authenticated;
