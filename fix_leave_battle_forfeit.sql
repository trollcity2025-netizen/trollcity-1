-- Fix leave_battle to only clear battle from the forfeiting user's stream
-- This prevents both broadcasters from being kicked out when one forfeits

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
    v_forfeiting_stream_id UUID;
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

    -- Determine winner and who is forfeiting
    IF p_user_id = v_challenger_owner THEN
        v_winner_stream_id := v_battle.opponent_stream_id;
        v_forfeiting_stream_id := v_battle.challenger_stream_id;
    ELSIF p_user_id = v_opponent_owner THEN
        v_winner_stream_id := v_battle.challenger_stream_id;
        v_forfeiting_stream_id := v_battle.opponent_stream_id;
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Not a participant');
    END IF;

    -- Update battle status and winner
    UPDATE public.battles
    SET 
        status = 'ended', 
        ended_at = NOW(),
        winner_id = v_winner_stream_id,
        winner_stream_id = v_winner_stream_id
    WHERE id = p_battle_id;

    -- Only clear battle_id from the forfeiting user's stream, not both
    -- This keeps the other broadcaster in their broadcast
    UPDATE public.streams
    SET battle_id = NULL
    WHERE id = v_forfeiting_stream_id;

    RETURN jsonb_build_object(
        'success', true, 
        'winner_stream_id', v_winner_stream_id,
        'forfeiting_stream_id', v_forfeiting_stream_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_battle(UUID, UUID) TO authenticated;
