-- Fix RPCs to match the actual troll_battles schema (host_id, challenger_id)

-- Drop the old functions first to be safe (if signatures match)
DROP FUNCTION IF EXISTS public.find_opponent(uuid);
DROP FUNCTION IF EXISTS public.start_battle(uuid);

-- Recreate find_opponent using host_id/challenger_id
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
    -- Check if already in a pending battle
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
        INSERT INTO public.troll_battles (host_id, challenger_id, status)
        VALUES (p_user_id, v_opponent_id, 'pending')
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

-- Recreate start_battle using host_id/challenger_id logic (if needed, though it just updates status)
CREATE OR REPLACE FUNCTION public.start_battle(p_battle_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.troll_battles
    SET status = 'active', start_time = NOW(), end_time = NOW() + INTERVAL '3 minutes'
    WHERE id = p_battle_id AND status = 'pending';
END;
$$;
