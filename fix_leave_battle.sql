-- Fix leave_battle to properly end battle and clear all battle state
-- This ensures battle ends immediately when user forfeits
-- Run this in Supabase SQL Editor

-- Drop existing function first
DROP FUNCTION IF EXISTS public.leave_battle(UUID, UUID);

-- Create new function with proper battle ending
CREATE FUNCTION public.leave_battle(
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
    v_winner_user_id UUID;
    v_loser_user_id UUID;
    v_challenger_stream_id UUID;
    v_opponent_stream_id UUID;
BEGIN
    -- Check authorization - allow admin to end any battle
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Get battle details
    SELECT * INTO v_battle
    FROM public.battles
    WHERE id = p_battle_id;

    IF v_battle IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Battle not found');
    END IF;

    IF v_battle.status <> 'active' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Battle is not active');
    END IF;

    -- Store stream IDs in local variables for use in UPDATE
    v_challenger_stream_id := v_battle.challenger_stream_id;
    v_opponent_stream_id := v_battle.opponent_stream_id;

    -- Get stream owners
    SELECT user_id INTO v_challenger_owner FROM public.streams WHERE id = v_challenger_stream_id;
    SELECT user_id INTO v_opponent_owner FROM public.streams WHERE id = v_opponent_stream_id;

    -- Determine winner (the other broadcaster)
    IF p_user_id = v_challenger_owner THEN
        v_winner_stream_id := v_battle.opponent_stream_id;
        v_winner_user_id := v_opponent_owner;
        v_loser_user_id := v_challenger_owner;
    ELSIF p_user_id = v_opponent_owner THEN
        v_winner_stream_id := v_battle.challenger_stream_id;
        v_winner_user_id := v_challenger_owner;
        v_loser_user_id := v_opponent_owner;
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Not a participant in this battle');
    END IF;

    -- Update battle status to ended
    UPDATE public.battles
    SET status = 'ended', 
        ended_at = NOW(), 
        winner_id = v_winner_user_id,
        winner_stream_id = v_winner_stream_id
    WHERE id = p_battle_id;

    -- Credit winner with a battle win in leaderboard
    IF v_winner_user_id IS NOT NULL THEN
        UPDATE public.user_profiles
        SET battle_wins = COALESCE(battle_wins, 0) + 1
        WHERE id = v_winner_user_id;
    END IF;

    -- Record loser with a battle loss
    IF v_loser_user_id IS NOT NULL THEN
        UPDATE public.user_profiles
        SET battle_losses = COALESCE(battle_losses, 0) + 1
        WHERE id = v_loser_user_id;
    END IF;

    -- CRITICAL: Reset BOTH streams from battle mode (not just the one with battle_id)
    UPDATE public.streams
    SET battle_id = NULL, is_battle = false
    WHERE id = v_challenger_stream_id OR id = v_opponent_stream_id;

    RETURN jsonb_build_object('success', true, 'winner_stream_id', v_winner_stream_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_battle(UUID, UUID) TO authenticated;
