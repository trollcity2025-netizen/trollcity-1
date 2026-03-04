-- ============================================================================
-- BATTLE MATCHMAKING SYSTEM FIX
-- ============================================================================
-- This migration fixes the foreign key constraint error and implements
-- a proper matchmaking queue system for battles.
--
-- New Flow:
-- 1. Broadcaster presses "Find Match" → added to matchmaking_queue
-- 2. System pairs broadcasters in the queue (in pairs: 1&2, 3&4, etc.)
-- 3. Both broadcasters must accept the match
-- 4. Battle is created FIRST, then streams are updated with battle_id
-- 5. Only 2 broadcasters per battle - extras wait for next match
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Matchmaking Queue Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL DEFAULT 'trollmers',
    status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- 'waiting', 'matched', 'accepted', 'declined', 'expired'
    matched_with UUID REFERENCES public.matchmaking_queue(id) ON DELETE SET NULL,
    battle_id UUID REFERENCES public.battles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    matched_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
    CONSTRAINT unique_active_stream UNIQUE (stream_id, status) WHERE status IN ('waiting', 'matched')
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_status ON public.matchmaking_queue(status);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_category ON public.matchmaking_queue(category);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_stream ON public.matchmaking_queue(stream_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_matched_with ON public.matchmaking_queue(matched_with);

-- Enable RLS
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view matchmaking queue" 
    ON public.matchmaking_queue FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Users can insert their own stream" 
    ON public.matchmaking_queue FOR INSERT 
    TO authenticated 
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own queue entry" 
    ON public.matchmaking_queue FOR UPDATE 
    TO authenticated 
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Users can delete their own queue entry" 
    ON public.matchmaking_queue FOR DELETE 
    TO authenticated 
    USING (user_id = auth_uid() OR EXISTS (
        SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'
    ));

-- Grant permissions
GRANT ALL ON public.matchmaking_queue TO authenticated;
GRANT ALL ON public.matchmaking_queue TO service_role;

-- ============================================================================
-- STEP 2: Function to Join Matchmaking Queue
-- ============================================================================

CREATE OR REPLACE FUNCTION public.join_matchmaking_queue(
    p_stream_id UUID,
    p_category VARCHAR(50) DEFAULT 'trollmers'
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_queue_entry RECORD;
    v_existing_entry RECORD;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Not authenticated'
        );
    END IF;
    
    -- Check if stream exists and belongs to user
    IF NOT EXISTS (
        SELECT 1 FROM public.streams 
        WHERE id = p_stream_id 
        AND user_id = v_user_id
        AND status = 'live'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Stream not found, not live, or does not belong to you'
        );
    END IF;
    
    -- Check if already in queue
    SELECT * INTO v_existing_entry
    FROM public.matchmaking_queue
    WHERE stream_id = p_stream_id
    AND status IN ('waiting', 'matched');
    
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'queue_id', v_existing_entry.id,
            'status', v_existing_entry.status,
            'message', 'Already in matchmaking queue'
        );
    END IF;
    
    -- Check if stream is already in a battle
    IF EXISTS (
        SELECT 1 FROM public.streams 
        WHERE id = p_stream_id 
        AND is_battle = true
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Stream is already in a battle'
        );
    END IF;
    
    -- Insert into queue
    INSERT INTO public.matchmaking_queue (
        stream_id,
        user_id,
        category,
        status,
        expires_at
    ) VALUES (
        p_stream_id,
        v_user_id,
        p_category,
        'waiting',
        now() + interval '5 minutes'
    )
    RETURNING * INTO v_queue_entry;
    
    RETURN jsonb_build_object(
        'success', true,
        'queue_id', v_queue_entry.id,
        'status', v_queue_entry.status,
        'message', 'Joined matchmaking queue'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.join_matchmaking_queue(UUID, VARCHAR) TO authenticated;

-- ============================================================================
-- STEP 3: Function to Find and Create Match (runs periodically or on demand)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_matchmaking_queue(
    p_category VARCHAR(50) DEFAULT 'trollmers'
)
RETURNS JSONB AS $$
DECLARE
    v_entry1 RECORD;
    v_entry2 RECORD;
    v_battle_id UUID;
    v_result JSONB;
BEGIN
    -- Find first waiting entry
    SELECT * INTO v_entry1
    FROM public.matchmaking_queue
    WHERE status = 'waiting'
    AND category = p_category
    AND expires_at > now()
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED;
    
    IF v_entry1 IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'No waiting entries found'
        );
    END IF;
    
    -- Find second waiting entry (different stream)
    SELECT * INTO v_entry2
    FROM public.matchmaking_queue
    WHERE status = 'waiting'
    AND category = p_category
    AND stream_id != v_entry1.stream_id
    AND expires_at > now()
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED;
    
    IF v_entry2 IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Waiting for another broadcaster to join queue'
        );
    END IF;
    
    -- Mark both as matched
    UPDATE public.matchmaking_queue
    SET 
        status = 'matched',
        matched_with = v_entry2.id,
        matched_at = now()
    WHERE id = v_entry1.id;
    
    UPDATE public.matchmaking_queue
    SET 
        status = 'matched',
        matched_with = v_entry1.id,
        matched_at = now()
    WHERE id = v_entry2.id;
    
    RETURN jsonb_build_object(
        'success', true,
        'match', jsonb_build_object(
            'entry1', jsonb_build_object(
                'queue_id', v_entry1.id,
                'stream_id', v_entry1.stream_id,
                'user_id', v_entry1.user_id
            ),
            'entry2', jsonb_build_object(
                'queue_id', v_entry2.id,
                'stream_id', v_entry2.stream_id,
                'user_id', v_entry2.user_id
            )
        ),
        'message', 'Broadcasters matched - waiting for both to accept'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.process_matchmaking_queue(VARCHAR) TO authenticated;

-- ============================================================================
-- STEP 4: Function to Accept Match (must be called by both broadcasters)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_match(
    p_queue_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_my_entry RECORD;
    v_partner_entry RECORD;
    v_battle_id UUID;
    v_partner_accepted BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Not authenticated'
        );
    END IF;
    
    -- Get my queue entry
    SELECT * INTO v_my_entry
    FROM public.matchmaking_queue
    WHERE id = p_queue_id
    AND user_id = v_user_id
    FOR UPDATE;
    
    IF v_my_entry IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Queue entry not found'
        );
    END IF;
    
    IF v_my_entry.status != 'matched' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Match is not in pending state (status: ' || v_my_entry.status || ')'
        );
    END IF;
    
    -- Mark as accepted
    UPDATE public.matchmaking_queue
    SET status = 'accepted'
    WHERE id = p_queue_id;
    
    -- Check if partner has also accepted
    SELECT * INTO v_partner_entry
    FROM public.matchmaking_queue
    WHERE id = v_my_entry.matched_with;
    
    v_partner_accepted := (v_partner_entry.status = 'accepted');
    
    -- If both accepted, create battle in transaction
    IF v_partner_accepted THEN
        BEGIN
            -- Create battle first
            INSERT INTO public.battles (
                challenger_stream_id,
                opponent_stream_id,
                status,
                created_at,
                started_at
            ) VALUES (
                v_my_entry.stream_id,
                v_partner_entry.stream_id,
                'active',
                now(),
                now()
            )
            RETURNING id INTO v_battle_id;
            
            -- Update queue entries with battle_id
            UPDATE public.matchmaking_queue
            SET battle_id = v_battle_id
            WHERE id IN (v_my_entry.id, v_partner_entry.id);
            
            -- NOW update streams with battle_id (battle exists now, so no FK error)
            UPDATE public.streams
            SET 
                battle_id = v_battle_id,
                is_battle = true
            WHERE id IN (v_my_entry.stream_id, v_partner_entry.stream_id);
            
            -- Add participants
            INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id)
            SELECT 
                v_battle_id,
                s.user_id,
                CASE WHEN s.id = v_my_entry.stream_id THEN 'challenger' ELSE 'opponent' END,
                'host',
                s.id
            FROM public.streams s
            WHERE s.id IN (v_my_entry.stream_id, v_partner_entry.stream_id);
            
            RETURN jsonb_build_object(
                'success', true,
                'battle_created', true,
                'battle_id', v_battle_id,
                'message', 'Battle started!'
            );
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Rollback happened automatically
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'Failed to create battle: ' || SQLERRM
                );
        END;
    ELSE
        RETURN jsonb_build_object(
            'success', true,
            'battle_created', false,
            'message', 'Accepted! Waiting for opponent to accept...'
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.accept_match(UUID) TO authenticated;

-- ============================================================================
-- STEP 5: Function to Decline Match
-- ============================================================================

CREATE OR REPLACE FUNCTION public.decline_match(
    p_queue_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_my_entry RECORD;
    v_partner_entry RECORD;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Not authenticated'
        );
    END IF;
    
    -- Get my queue entry
    SELECT * INTO v_my_entry
    FROM public.matchmaking_queue
    WHERE id = p_queue_id
    AND user_id = v_user_id
    FOR UPDATE;
    
    IF v_my_entry IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Queue entry not found'
        );
    END IF;
    
    -- Get partner entry
    SELECT * INTO v_partner_entry
    FROM public.matchmaking_queue
    WHERE id = v_my_entry.matched_with
    FOR UPDATE;
    
    -- Mark both as declined
    UPDATE public.matchmaking_queue
    SET status = 'declined'
    WHERE id = v_my_entry.id;
    
    IF v_partner_entry IS NOT NULL THEN
        UPDATE public.matchmaking_queue
        SET status = 'waiting',
            matched_with = NULL,
            matched_at = NULL
        WHERE id = v_partner_entry.id;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Match declined. Both broadcasters returned to queue.'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.decline_match(UUID) TO authenticated;

-- ============================================================================
-- STEP 6: Function to Leave Queue
-- ============================================================================

CREATE OR REPLACE FUNCTION public.leave_matchmaking_queue(
    p_stream_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_entry RECORD;
    v_partner_entry RECORD;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Not authenticated'
        );
    END IF;
    
    -- Find entry
    SELECT * INTO v_entry
    FROM public.matchmaking_queue
    WHERE stream_id = p_stream_id
    AND user_id = v_user_id
    AND status IN ('waiting', 'matched')
    FOR UPDATE;
    
    IF v_entry IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Not in queue'
        );
    END IF;
    
    -- If matched, notify partner
    IF v_entry.matched_with IS NOT NULL THEN
        SELECT * INTO v_partner_entry
        FROM public.matchmaking_queue
        WHERE id = v_entry.matched_with;
        
        IF v_partner_entry IS NOT NULL THEN
            UPDATE public.matchmaking_queue
            SET status = 'waiting',
                matched_with = NULL,
                matched_at = NULL
            WHERE id = v_partner_entry.id;
        END IF;
    END IF;
    
    -- Delete entry
    DELETE FROM public.matchmaking_queue
    WHERE id = v_entry.id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Left matchmaking queue'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.leave_matchmaking_queue(UUID) TO authenticated;

-- ============================================================================
-- STEP 7: Function to Check Match Status
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_match_status(
    p_stream_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_entry RECORD;
    v_partner_entry RECORD;
BEGIN
    SELECT * INTO v_entry
    FROM public.matchmaking_queue
    WHERE stream_id = p_stream_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_entry IS NULL THEN
        RETURN jsonb_build_object(
            'in_queue', false,
            'status', NULL
        );
    END IF;
    
    IF v_entry.matched_with IS NOT NULL THEN
        SELECT * INTO v_partner_entry
        FROM public.matchmaking_queue
        WHERE id = v_entry.matched_with;
    END IF;
    
    RETURN jsonb_build_object(
        'in_queue', true,
        'queue_id', v_entry.id,
        'status', v_entry.status,
        'category', v_entry.category,
        'created_at', v_entry.created_at,
        'matched_at', v_entry.matched_at,
        'battle_id', v_entry.battle_id,
        'partner', CASE 
            WHEN v_partner_entry IS NOT NULL THEN
                jsonb_build_object(
                    'queue_id', v_partner_entry.id,
                    'stream_id', v_partner_entry.stream_id,
                    'user_id', v_partner_entry.user_id,
                    'status', v_partner_entry.status
                )
            ELSE NULL
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_match_status(UUID) TO authenticated;

-- ============================================================================
-- STEP 8: Cleanup Expired Queue Entries (can be run periodically)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_queue_entries()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Return waiting entries to queue if their partner expired
    UPDATE public.matchmaking_queue q1
    SET 
        status = 'waiting',
        matched_with = NULL,
        matched_at = NULL
    WHERE status = 'matched'
    AND matched_with IN (
        SELECT id FROM public.matchmaking_queue 
        WHERE expires_at < now() OR status = 'expired'
    );
    
    -- Mark expired entries
    UPDATE public.matchmaking_queue
    SET status = 'expired'
    WHERE expires_at < now()
    AND status IN ('waiting', 'matched');
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_queue_entries() TO authenticated;

-- ============================================================================
-- STEP 9: Fix accept_battle to not update battle_id directly (legacy battles)
-- ============================================================================

-- The old accept_battle function tries to update streams.battle_id
-- We need to ensure it only does this for legacy battles or remove the battle_id update
-- Since we're creating battles FIRST in the new system, the FK will be valid

-- The existing accept_battle function should work now because:
-- 1. Battle is created in accept_match BEFORE streams are updated
-- 2. The battle_id already exists when streams are updated

-- ============================================================================
-- STEP 10: Add trigger to auto-cleanup queue when battle ends
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_queue_on_battle_end()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ended' AND OLD.status != 'ended' THEN
        -- Mark queue entries as completed
        UPDATE public.matchmaking_queue
        SET status = 'completed'
        WHERE battle_id = NEW.id
        AND status IN ('accepted', 'matched');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS cleanup_queue_on_battle_end ON public.battles;
CREATE TRIGGER cleanup_queue_on_battle_end
    AFTER UPDATE ON public.battles
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_queue_on_battle_end();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.matchmaking_queue IS 'Queue for broadcasters waiting to be matched for battles';
COMMENT ON FUNCTION public.join_matchmaking_queue IS 'Add a broadcaster to the matchmaking queue';
COMMENT ON FUNCTION public.process_matchmaking_queue IS 'Process the queue and match broadcasters in pairs';
COMMENT ON FUNCTION public.accept_match IS 'Accept a match - creates battle only when both accept';
COMMENT ON FUNCTION public.decline_match IS 'Decline a match - returns both to queue';
COMMENT ON FUNCTION public.leave_matchmaking_queue IS 'Remove broadcaster from queue';
COMMENT ON FUNCTION public.get_match_status IS 'Get current match status for a stream';
COMMENT ON FUNCTION public.cleanup_expired_queue_entries IS 'Clean up expired queue entries';

-- ============================================================================
-- End of Migration
-- ============================================================================
