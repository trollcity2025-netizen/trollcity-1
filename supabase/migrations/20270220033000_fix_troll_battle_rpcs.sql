-- Migration: Fix Troll Battle RPCs to use new schema (host_id/challenger_id)
-- Also updates score columns to host_troll_coins/challenger_troll_coins

-- 1. Fix find_opponent
CREATE OR REPLACE FUNCTION public.find_opponent(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_opponent_id UUID;
    v_battle_id UUID;
    v_existing_battle JSONB;
BEGIN
    -- Check if already in a pending battle (as host or challenger)
    SELECT to_jsonb(t) INTO v_existing_battle
    FROM public.troll_battles t
    WHERE (host_id = p_user_id OR challenger_id = p_user_id)
      AND status = 'pending'
    LIMIT 1;

    IF v_existing_battle IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'matched', 'battle', v_existing_battle);
    END IF;

    -- Try to find someone else in the queue
    SELECT user_id INTO v_opponent_id
    FROM public.battle_queue
    WHERE user_id != p_user_id
    ORDER BY joined_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_opponent_id IS NOT NULL THEN
        -- Match found! Create battle
        -- NOTE: Assign p_user_id as challenger to the person in queue? Or vice versa?
        -- Let's make the person in queue the host (they waited longer?) or just arbitrary.
        -- Let's stick to: p_user_id (newcomer) is challenger, v_opponent_id (queued) is host.
        INSERT INTO public.troll_battles (host_id, challenger_id, status)
        VALUES (v_opponent_id, p_user_id, 'pending')
        RETURNING id INTO v_battle_id;

        -- Remove both from queue
        DELETE FROM public.battle_queue WHERE user_id IN (p_user_id, v_opponent_id);

        RETURN jsonb_build_object('status', 'matched', 'battle_id', v_battle_id, 'opponent_id', v_opponent_id);
    ELSE
        -- No match, add to queue
        INSERT INTO public.battle_queue (user_id)
        VALUES (p_user_id)
        ON CONFLICT (user_id) DO NOTHING;
        
        RETURN jsonb_build_object('status', 'queued');
    END IF;
END;
$$;

-- 2. Fix get_active_battle
CREATE OR REPLACE FUNCTION public.get_active_battle(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle JSONB;
BEGIN
    SELECT to_jsonb(t) INTO v_battle
    FROM public.troll_battles t
    WHERE (host_id = p_user_id OR challenger_id = p_user_id)
      AND status = 'active'
    LIMIT 1;

    IF v_battle IS NOT NULL THEN
        RETURN jsonb_build_object('active', true, 'battle', v_battle);
    ELSE
        RETURN jsonb_build_object('active', false);
    END IF;
END;
$$;

-- 3. Fix register_battle_score (Legacy RPC, but kept for compatibility)
CREATE OR REPLACE FUNCTION public.register_battle_score(
    p_battle_id UUID,
    p_recipient_id UUID,
    p_score INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle RECORD;
    v_new_score INTEGER;
BEGIN
    -- Get battle
    SELECT * INTO v_battle FROM public.troll_battles WHERE id = p_battle_id;
    
    IF v_battle IS NULL OR v_battle.status != 'active' THEN
        RETURN jsonb_build_object('error', 'Battle not active');
    END IF;

    -- Update score (mapping to troll_coins columns)
    IF v_battle.host_id = p_recipient_id THEN
        UPDATE public.troll_battles 
        SET host_troll_coins = COALESCE(host_troll_coins, 0) + p_score, updated_at = NOW()
        WHERE id = p_battle_id
        RETURNING host_troll_coins INTO v_new_score;
        
        RETURN jsonb_build_object('success', true, 'player', 1, 'new_score', v_new_score);
    ELSIF v_battle.challenger_id = p_recipient_id THEN
        UPDATE public.troll_battles 
        SET challenger_troll_coins = COALESCE(challenger_troll_coins, 0) + p_score, updated_at = NOW()
        WHERE id = p_battle_id
        RETURNING challenger_troll_coins INTO v_new_score;
        
        RETURN jsonb_build_object('success', true, 'player', 2, 'new_score', v_new_score);
    ELSE
        -- Recipient is not in the battle
        RETURN jsonb_build_object('success', false, 'message', 'Recipient not in battle');
    END IF;
END;
$$;
