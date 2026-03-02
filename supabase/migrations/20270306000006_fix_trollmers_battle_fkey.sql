-- Fix Trollmers Head-to-Head Battle Foreign Key Constraint Error
-- This migration fixes the 'stream_battle_id_fkey' error that occurs when accepting battles

-- Drop existing function to ensure clean replacement
DROP FUNCTION IF EXISTS public.accept_battle(UUID);

-- Create fixed accept_battle function with proper validation and row locking
CREATE OR REPLACE FUNCTION public.accept_battle(
    p_battle_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_battle RECORD;
    v_challenger_stream RECORD;
    v_opponent_stream RECORD;
BEGIN
    -- 1. Lock the battle row to prevent race conditions
    SELECT * INTO v_battle
    FROM public.battles
    WHERE id = p_battle_id
    FOR UPDATE;

    -- 2. Validate battle exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Battle not found: %', p_battle_id;
    END IF;

    -- 3. Ensure the battle is still 'pending'
    IF v_battle.status != 'pending' THEN
        RAISE EXCEPTION 'Battle is not pending (status: %)', v_battle.status;
    END IF;

    -- 4. Lock both streams to prevent concurrent modifications
    SELECT * INTO v_challenger_stream 
    FROM public.streams 
    WHERE id = v_battle.challenger_stream_id 
    FOR UPDATE;
    
    SELECT * INTO v_opponent_stream 
    FROM public.streams 
    WHERE id = v_battle.opponent_stream_id 
    FOR UPDATE;

    -- 5. Validate both streams exist
    IF v_challenger_stream IS NULL OR v_opponent_stream IS NULL THEN
        RAISE EXCEPTION 'One or both streams not found';
    END IF;

    -- 6. Check if either stream is already in another battle
    IF v_challenger_stream.is_battle AND v_challenger_stream.battle_id != p_battle_id THEN
        RAISE EXCEPTION 'Challenger stream is already in another battle';
    END IF;
    
    IF v_opponent_stream.is_battle AND v_opponent_stream.battle_id != p_battle_id THEN
        RAISE EXCEPTION 'Opponent stream is already in another battle';
    END IF;

    -- 7. Transition battle to 'active' (do this BEFORE updating streams)
    UPDATE public.battles
    SET 
        status = 'active',
        started_at = now()
    WHERE id = p_battle_id;

    -- 8. Set battle_id AND is_battle on both streams (AFTER battle is active)
    UPDATE public.streams 
    SET battle_id = p_battle_id, is_battle = true 
    WHERE id = v_battle.challenger_stream_id;
    
    UPDATE public.streams 
    SET battle_id = p_battle_id, is_battle = true 
    WHERE id = v_battle.opponent_stream_id;

    -- 9. Snapshot Battle Hosts into battle_participants
    INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id)
    VALUES 
        (p_battle_id, v_challenger_stream.user_id, 'challenger', 'host', v_battle.challenger_stream_id),
        (p_battle_id, v_opponent_stream.user_id, 'opponent', 'host', v_battle.opponent_stream_id)
    ON CONFLICT (battle_id, user_id) DO NOTHING;

    -- 10. Snapshot Stage Guests (Challenger)
    INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id, seat_index)
    SELECT 
        p_battle_id,
        user_id,
        'challenger',
        'stage',
        v_battle.challenger_stream_id,
        seat_index
    FROM public.stream_seat_sessions
    WHERE stream_id = v_battle.challenger_stream_id 
      AND status = 'active' 
      AND user_id IS NOT NULL
    ON CONFLICT (battle_id, user_id) DO NOTHING;

    -- 11. Snapshot Stage Guests (Opponent)
    INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id, seat_index)
    SELECT 
        p_battle_id,
        user_id,
        'opponent',
        'stage',
        v_battle.opponent_stream_id,
        seat_index
    FROM public.stream_seat_sessions
    WHERE stream_id = v_battle.opponent_stream_id 
      AND status = 'active' 
      AND user_id IS NOT NULL
    ON CONFLICT (battle_id, user_id) DO NOTHING;

    -- 12. Send realtime notifications to both streams
    PERFORM pg_notify(
        'realtime', 
        json_build_object(
            'table', 'streams',
            'type', 'UPDATE',
            'record', json_build_object(
                'id', v_battle.challenger_stream_id, 
                'battle_id', p_battle_id,
                'is_battle', true
            )
        )::text
    );
    
    PERFORM pg_notify(
        'realtime', 
        json_build_object(
            'table', 'streams',
            'type', 'UPDATE',
            'record', json_build_object(
                'id', v_battle.opponent_stream_id, 
                'battle_id', p_battle_id,
                'is_battle', true
            )
        )::text
    );

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error details and re-raise
        RAISE WARNING 'Error in accept_battle: %', SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.accept_battle(UUID) TO authenticated;

-- Also fix create_battle_challenge to ensure atomic creation
CREATE OR REPLACE FUNCTION public.create_battle_challenge(
    p_challenger_id UUID,
    p_opponent_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_battle_id UUID;
    v_challenger_exists BOOLEAN;
    v_opponent_exists BOOLEAN;
BEGIN
    -- Verify both streams exist and are live
    SELECT EXISTS(SELECT 1 FROM public.streams WHERE id = p_challenger_id AND status = 'live') INTO v_challenger_exists;
    SELECT EXISTS(SELECT 1 FROM public.streams WHERE id = p_opponent_id AND status = 'live') INTO v_opponent_exists;
    
    IF NOT v_challenger_exists THEN
        RAISE EXCEPTION 'Challenger stream not found or not live';
    END IF;
    
    IF NOT v_opponent_exists THEN
        RAISE EXCEPTION 'Opponent stream not found or not live';
    END IF;
    
    -- Check if either stream is already in a battle
    IF EXISTS(SELECT 1 FROM public.streams WHERE id = p_challenger_id AND is_battle = true) THEN
        RAISE EXCEPTION 'Challenger is already in a battle';
    END IF;
    
    IF EXISTS(SELECT 1 FROM public.streams WHERE id = p_opponent_id AND is_battle = true) THEN
        RAISE EXCEPTION 'Opponent is already in a battle';
    END IF;

    -- Create the battle
    INSERT INTO public.battles (
        challenger_stream_id, 
        opponent_stream_id,
        status,
        created_at
    )
    VALUES (
        p_challenger_id, 
        p_opponent_id,
        'pending',
        now()
    )
    RETURNING id INTO v_battle_id;
    
    -- Verify battle was created
    IF v_battle_id IS NULL THEN
        RAISE EXCEPTION 'Failed to create battle';
    END IF;
    
    RETURN v_battle_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in create_battle_challenge: %', SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_battle_challenge(UUID, UUID) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.accept_battle(UUID) IS 
'Accepts a battle challenge and properly updates both streams with battle_id. 
Uses row locking to prevent race conditions and validates battle exists before updating streams.';

COMMENT ON FUNCTION public.create_battle_challenge(UUID, UUID) IS 
'Creates a battle challenge between two streamers with validation that both streams are live and not already in battles.';
