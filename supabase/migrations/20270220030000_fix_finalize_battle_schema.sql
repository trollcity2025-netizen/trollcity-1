-- Fix finalize_battle function to use host_id/challenger_id schema
CREATE OR REPLACE FUNCTION public.finalize_battle(p_battle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle RECORD;
    v_winner_id UUID;
    v_week_start DATE;
BEGIN
    SELECT * INTO v_battle FROM public.troll_battles WHERE id = p_battle_id;

    IF v_battle IS NULL OR v_battle.status != 'active' THEN
        RETURN jsonb_build_object('error', 'Battle not active or not found');
    END IF;

    -- Check if time has passed (allow minimal grace period for latency)
    IF NOW() < v_battle.end_time THEN
         RETURN jsonb_build_object('error', 'Battle not yet ended');
    END IF;

    -- Determine winner
    IF v_battle.host_score > v_battle.challenger_score THEN
        v_winner_id := v_battle.host_id;
    ELSIF v_battle.challenger_score > v_battle.host_score THEN
        v_winner_id := v_battle.challenger_id;
    ELSE
        v_winner_id := NULL; -- Draw
    END IF;

    -- Update battle
    UPDATE public.troll_battles
    SET status = 'completed', winner_id = v_winner_id, updated_at = NOW()
    WHERE id = p_battle_id;

    -- Update stats
    v_week_start := date_trunc('week', CURRENT_DATE);

    -- Host Stats
    INSERT INTO public.troll_battle_weekly_stats (user_id, week_start_date, wins, losses, total_score)
    VALUES (
        v_battle.host_id, 
        v_week_start, 
        CASE WHEN v_winner_id = v_battle.host_id THEN 1 ELSE 0 END,
        CASE WHEN v_winner_id = v_battle.challenger_id THEN 1 ELSE 0 END,
        v_battle.host_troll_coins
    )
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET
        wins = public.troll_battle_weekly_stats.wins + EXCLUDED.wins,
        losses = public.troll_battle_weekly_stats.losses + EXCLUDED.losses,
        total_score = public.troll_battle_weekly_stats.total_score + EXCLUDED.total_score;

    -- Challenger Stats
    INSERT INTO public.troll_battle_weekly_stats (user_id, week_start_date, wins, losses, total_score)
    VALUES (
        v_battle.challenger_id, 
        v_week_start, 
        CASE WHEN v_winner_id = v_battle.challenger_id THEN 1 ELSE 0 END,
        CASE WHEN v_winner_id = v_battle.host_id THEN 1 ELSE 0 END,
        v_battle.challenger_troll_coins
    )
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET
        wins = public.troll_battle_weekly_stats.wins + EXCLUDED.wins,
        losses = public.troll_battle_weekly_stats.losses + EXCLUDED.losses,
        total_score = public.troll_battle_weekly_stats.total_score + EXCLUDED.total_score;

    RETURN jsonb_build_object('success', true, 'winner_id', v_winner_id);
END;
$$;
