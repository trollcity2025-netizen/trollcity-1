-- ============================================================================
-- INSTANT BATTLE MATCHMAKING SYSTEM - FIXED VERSION
-- ============================================================================
-- This version ensures broadcasters wait in queue until an opponent joins
-- ============================================================================

-- Drop and recreate the battle_queue table
DROP TABLE IF EXISTS public.battle_queue;

CREATE TABLE public.battle_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL DEFAULT 'trollmers',
    status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    battle_id UUID REFERENCES public.battles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index to ensure only one waiting entry per stream
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_waiting_stream 
ON public.battle_queue (stream_id) 
WHERE status = 'waiting';

-- Enable RLS
ALTER TABLE public.battle_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "View battle queue" ON public.battle_queue;
DROP POLICY IF EXISTS "Insert own queue entry" ON public.battle_queue;
DROP POLICY IF EXISTS "Update own queue entry" ON public.battle_queue;
DROP POLICY IF EXISTS "Delete own queue entry" ON public.battle_queue;

CREATE POLICY "View battle queue" ON public.battle_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own queue entry" ON public.battle_queue FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own queue entry" ON public.battle_queue FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Delete own queue entry" ON public.battle_queue FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT ALL ON public.battle_queue TO authenticated;

-- ============================================================================
-- STEP 2: Function to Start Instant Battle - FIXED TO ALWAYS WAIT FOR OPPONENT
-- ============================================================================

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
    -- Get the authenticated user
    v_user_id := auth.uid();
    
    RAISE NOTICE 'start_instant_battle called for stream % by user %', p_stream_id, v_user_id;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Verify stream is live and belongs to user
    SELECT * INTO v_my_stream
    FROM public.streams
    WHERE id = p_stream_id
    AND user_id = v_user_id
    AND status = 'live'
    AND is_battle = false;
    
    IF v_my_stream IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stream not live or already in battle');
    END IF;
    
    -- Check if already in queue with waiting status
    IF EXISTS (SELECT 1 FROM public.battle_queue WHERE stream_id = p_stream_id AND status = 'waiting') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already waiting for battle');
    END IF;
    
    -- Check if already in battle
    IF EXISTS (SELECT 1 FROM public.battle_queue WHERE stream_id = p_stream_id AND status = 'battling') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already in a battle');
    END IF;
    
    -- Count total waiting players in this category
    SELECT COUNT(*) INTO v_queue_count
    FROM public.battle_queue
    WHERE status = 'waiting'
    AND category = p_category;
    
    RAISE NOTICE 'Current queue count for category %: %', p_category, v_queue_count;
    
    -- CRITICAL FIX: Only look for opponent if there are OTHER players in queue
    -- We explicitly check that the opponent is NOT our own stream
    v_opponent_count := 0;
    
    SELECT COUNT(*) INTO v_opponent_count
    FROM public.battle_queue
    WHERE status = 'waiting'
    AND category = p_category
    AND stream_id != p_stream_id;
    
    RAISE NOTICE 'Found % potential opponents', v_opponent_count;
    
    -- If no opponent found (v_opponent_count = 0), ALWAYS add to queue and wait
    IF v_opponent_count = 0 THEN
        RAISE NOTICE 'No opponent found, adding to queue and waiting';
        
        INSERT INTO public.battle_queue (stream_id, user_id, category, status)
        VALUES (p_stream_id, v_user_id, p_category, 'waiting');
        
        RETURN jsonb_build_object(
            'success', true,
            'status', 'waiting',
            'message', 'Waiting for another broadcaster...'
        );
    END IF;
    
    -- Found an opponent - create battle
    RAISE NOTICE 'Opponent found, creating battle';
    
    BEGIN
        -- Get the actual opponent record
        SELECT * INTO v_opponent_queue
        FROM public.battle_queue
        WHERE status = 'waiting'
        AND category = p_category
        AND stream_id != p_stream_id
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1;
        
        IF v_opponent_queue IS NULL THEN
            -- Double-check: if still no opponent, add to queue
            RAISE NOTICE 'Race condition detected, adding to queue';
            INSERT INTO public.battle_queue (stream_id, user_id, category, status)
            VALUES (p_stream_id, v_user_id, p_category, 'waiting');
            
            RETURN jsonb_build_object(
                'success', true,
                'status', 'waiting',
                'message', 'Waiting for another broadcaster...'
            );
        END IF;
        
        -- Clear any stale battle_ids first (defensive)
        UPDATE public.streams
        SET battle_id = NULL, is_battle = false
        WHERE id IN (v_opponent_queue.stream_id, p_stream_id)
        AND (battle_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.battles b WHERE b.id = streams.battle_id
        ));
        
        -- Create battle record first
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
        
        -- Update opponent queue entry
        UPDATE public.battle_queue
        SET status = 'battling', battle_id = v_battle_id
        WHERE id = v_opponent_queue.id;
        
        -- Insert current stream into queue as battling
        INSERT INTO public.battle_queue (stream_id, user_id, category, status, battle_id)
        VALUES (p_stream_id, v_user_id, p_category, 'battling', v_battle_id);
        
        -- NOW update streams with battle_id (battle exists, so no FK error)
        UPDATE public.streams
        SET battle_id = v_battle_id, is_battle = true
        WHERE id IN (v_opponent_queue.stream_id, p_stream_id);
        
        -- Add participants
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
        RAISE NOTICE 'Error creating battle: %', SQLERRM;
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.start_instant_battle(UUID, VARCHAR) TO authenticated;

COMMENT ON FUNCTION public.start_instant_battle IS 'Start or join an instant battle - ALWAYS waits for opponent in queue';

-- ============================================================================
-- STEP 3: Function to Leave Battle Queue
-- ============================================================================

CREATE OR REPLACE FUNCTION public.leave_battle_queue(
    p_stream_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    DELETE FROM public.battle_queue
    WHERE stream_id = p_stream_id
    AND user_id = v_user_id
    AND status = 'waiting';
    
    RETURN jsonb_build_object('success', true, 'message', 'Left queue');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.leave_battle_queue(UUID) TO authenticated;

-- ============================================================================
-- STEP 4: Function to End Battle with Crown Rewards
-- ============================================================================

CREATE OR REPLACE FUNCTION public.end_battle_with_rewards(
    p_battle_id UUID,
    p_winner_stream_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_battle RECORD;
    v_winner_user_id UUID;
    v_loser_user_id UUID;
    v_crown_reward INTEGER := 10;
BEGIN
    SELECT * INTO v_battle
    FROM public.battles
    WHERE id = p_battle_id
    AND status = 'active'
    FOR UPDATE;
    
    IF v_battle IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Battle not found or not active');
    END IF;
    
    IF p_winner_stream_id IS NOT NULL THEN
        SELECT user_id INTO v_winner_user_id
        FROM public.streams WHERE id = p_winner_stream_id;
        
        SELECT user_id INTO v_loser_user_id
        FROM public.streams 
        WHERE id IN (v_battle.challenger_stream_id, v_battle.opponent_stream_id)
        AND id != p_winner_stream_id
        LIMIT 1;
    END IF;
    
    IF v_winner_user_id IS NOT NULL THEN
        UPDATE public.user_profiles
        SET crowns = COALESCE(crowns, 0) + v_crown_reward
        WHERE id = v_winner_user_id;
        
        INSERT INTO public.coin_ledger (
            user_id,
            amount,
            transaction_type,
            description,
            reference_id
        ) VALUES (
            v_winner_user_id,
            v_crown_reward,
            'crown_reward',
            'Battle win reward',
            p_battle_id
        );
    END IF;
    
    UPDATE public.battles
    SET 
        status = 'ended',
        ended_at = now(),
        winner_stream_id = p_winner_stream_id
    WHERE id = p_battle_id;
    
    UPDATE public.streams
    SET battle_id = NULL, is_battle = false
    WHERE id IN (v_battle.challenger_stream_id, v_battle.opponent_stream_id);
    
    DELETE FROM public.battle_queue WHERE battle_id = p_battle_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'winner_id', v_winner_user_id,
        'crowns_awarded', CASE WHEN v_winner_user_id IS NOT NULL THEN v_crown_reward ELSE 0 END,
        'message', CASE 
            WHEN v_winner_user_id IS NOT NULL THEN 'Battle ended! Winner received ' || v_crown_reward || ' crowns!'
            ELSE 'Battle ended in a draw'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.end_battle_with_rewards(UUID, UUID) TO authenticated;

-- ============================================================================
-- STEP 5: Function to Check Battle Status (for polling)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_battle_status(
    p_stream_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_queue_entry RECORD;
    v_battle RECORD;
    v_opponent_stream_id UUID;
BEGIN
    SELECT * INTO v_queue_entry
    FROM public.battle_queue
    WHERE stream_id = p_stream_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_queue_entry IS NULL THEN
        RETURN jsonb_build_object('in_battle', false, 'in_queue', false);
    END IF;
    
    IF v_queue_entry.status = 'waiting' THEN
        RETURN jsonb_build_object(
            'in_battle', false,
            'in_queue', true,
            'waiting_since', v_queue_entry.created_at
        );
    END IF;
    
    SELECT * INTO v_battle
    FROM public.battles
    WHERE id = v_queue_entry.battle_id;
    
    IF v_battle IS NULL THEN
        RETURN jsonb_build_object('in_battle', false, 'in_queue', false);
    END IF;
    
    IF v_battle.challenger_stream_id = p_stream_id THEN
        v_opponent_stream_id := v_battle.opponent_stream_id;
    ELSE
        v_opponent_stream_id := v_battle.challenger_stream_id;
    END IF;
    
    RETURN jsonb_build_object(
        'in_battle', v_battle.status = 'active',
        'in_queue', false,
        'battle_id', v_battle.id,
        'battle_status', v_battle.status,
        'opponent_stream_id', v_opponent_stream_id,
        'started_at', v_battle.started_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_battle_status(UUID) TO authenticated;

-- ============================================================================
-- STEP 6: Cleanup function for old queue entries
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_battle_queue()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM public.battle_queue
    WHERE status = 'waiting'
    AND created_at < now() - interval '10 minutes';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.battle_queue IS 'Simple queue for instant battle matchmaking';
COMMENT ON FUNCTION public.start_instant_battle IS 'Start or join an instant battle - ALWAYS waits for opponent in queue';
COMMENT ON FUNCTION public.end_battle_with_rewards IS 'End battle and award crowns to winner';

-- ============================================================================
-- End of Migration
-- ============================================================================
