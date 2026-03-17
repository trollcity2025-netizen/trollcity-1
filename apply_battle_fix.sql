-- Just update the start_instant_battle function
CREATE OR REPLACE FUNCTION public.start_instant_battle(
    p_stream_id UUID,
    p_category VARCHAR(50) DEFAULT 'trollmers'
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_my_stream RECORD;
    v_opponent_queue RECORD;
    v_battle_id UUID;
    v_queue_count INTEGER;
    v_opponent_count INTEGER;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    SELECT * INTO v_my_stream
    FROM public.streams
    WHERE id = p_stream_id
    AND user_id = v_user_id
    AND status = 'live'
    AND is_battle = false;
    
    IF v_my_stream IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stream not live or already in battle');
    END IF;
    
    IF EXISTS (SELECT 1 FROM public.battle_queue WHERE stream_id = p_stream_id AND status = 'waiting') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already waiting for battle');
    END IF;
    
    IF EXISTS (SELECT 1 FROM public.battle_queue WHERE stream_id = p_stream_id AND status = 'battling') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already in a battle');
    END IF;
    
    SELECT COUNT(*) INTO v_queue_count
    FROM public.battle_queue
    WHERE status = 'waiting'
    AND category = p_category;
    
    v_opponent_count := 0;
    
    SELECT COUNT(*) INTO v_opponent_count
    FROM public.battle_queue
    WHERE status = 'waiting'
    AND category = p_category
    AND stream_id != p_stream_id;
    
    -- If no opponent found, ALWAYS add to queue and wait
    IF v_opponent_count = 0 THEN
        INSERT INTO public.battle_queue (stream_id, user_id, category, status)
        VALUES (p_stream_id, v_user_id, p_category, 'waiting');
        
        RETURN jsonb_build_object(
            'success', true,
            'status', 'waiting',
            'message', 'Waiting for another broadcaster...'
        );
    END IF;
    
    BEGIN
        SELECT * INTO v_opponent_queue
        FROM public.battle_queue
        WHERE status = 'waiting'
        AND category = p_category
        AND stream_id != p_stream_id
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1;
        
        IF v_opponent_queue IS NULL THEN
            INSERT INTO public.battle_queue (stream_id, user_id, category, status)
            VALUES (p_stream_id, v_user_id, p_category, 'waiting');
            
            RETURN jsonb_build_object(
                'success', true,
                'status', 'waiting',
                'message', 'Waiting for another broadcaster...'
            );
        END IF;
        
        UPDATE public.streams
        SET battle_id = NULL, is_battle = false
        WHERE id IN (v_opponent_queue.stream_id, p_stream_id)
        AND (battle_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.battles b WHERE b.id = streams.battle_id
        ));
        
        INSERT INTO public.battles (
            challenger_stream_id,
            opponent_stream_id,
            status,
            created_at,
            started_at,
            battle_type
        ) VALUES (
            v_opponent_queue.stream_id,
            p_stream_id,
            'active',
            now(),
            now(),
            p_category
        )
        RETURNING id INTO v_battle_id;
        
        UPDATE public.battle_queue
        SET status = 'battling', battle_id = v_battle_id
        WHERE id = v_opponent_queue.id;
        
        INSERT INTO public.battle_queue (stream_id, user_id, category, status, battle_id)
        VALUES (p_stream_id, v_user_id, p_category, 'battling', v_battle_id);
        
        UPDATE public.streams
        SET battle_id = v_battle_id, is_battle = true
        WHERE id IN (v_opponent_queue.stream_id, p_stream_id);
        
        INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id)
        SELECT v_battle_id, s.user_id, 
               CASE WHEN s.id = v_opponent_queue.stream_id THEN 'challenger' ELSE 'opponent' END,
               'host', s.id
        FROM public.streams s
        WHERE s.id IN (v_opponent_queue.stream_id, p_stream_id);
        
        RETURN jsonb_build_object(
            'success', true,
            'status', 'active',
            'battle_id', v_battle_id,
            'opponent_stream_id', v_opponent_queue.stream_id,
            'message', 'Battle started!'
        );
        
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.start_instant_battle(UUID, VARCHAR) TO authenticated;
