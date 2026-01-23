DROP FUNCTION IF EXISTS public.find_opponent(uuid, text, text, integer);

CREATE OR REPLACE FUNCTION public.find_opponent(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_opponent_id UUID;
    v_battle_id UUID;
    v_existing_battle JSONB;
BEGIN
    SELECT to_jsonb(t) INTO v_existing_battle
    FROM public.troll_battles t
    WHERE (player1_id = p_user_id OR player2_id = p_user_id)
      AND status = 'pending'
    LIMIT 1;

    IF v_existing_battle IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'matched', 'battle', v_existing_battle);
    END IF;

    SELECT user_id INTO v_opponent_id
    FROM public.battle_queue
    WHERE user_id != p_user_id
    ORDER BY joined_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_opponent_id IS NOT NULL THEN
        INSERT INTO public.troll_battles (player1_id, player2_id, status)
        VALUES (p_user_id, v_opponent_id, 'pending')
        RETURNING id INTO v_battle_id;

        DELETE FROM public.battle_queue WHERE user_id IN (p_user_id, v_opponent_id);

        RETURN jsonb_build_object('status', 'matched', 'battle_id', v_battle_id, 'opponent_id', v_opponent_id);
    ELSE
        INSERT INTO public.battle_queue (user_id)
        VALUES (p_user_id)
        ON CONFLICT (user_id) DO NOTHING;
        
        RETURN jsonb_build_object('status', 'queued');
    END IF;
END;
$$;
