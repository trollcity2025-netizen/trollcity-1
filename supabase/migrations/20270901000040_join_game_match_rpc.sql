CREATE OR REPLACE FUNCTION public.join_game_match(
    p_match_id UUID,
    p_user_id UUID,
    p_username TEXT
) RETURNS JSONB AS $$
DECLARE
    v_match_record public.troll_battles;
    v_game_state JSONB;
    v_player_exists BOOLEAN;
    v_current_players JSONB[];
    v_num_players INTEGER;
    v_min_players INTEGER;
    v_updated_game_state JSONB;
    v_player_state JSONB;
BEGIN
    -- Fetch the current match record and lock it for update
    SELECT * INTO v_match_record FROM public.troll_battles WHERE id = p_match_id FOR UPDATE;

    IF v_match_record IS NULL THEN
        RAISE EXCEPTION 'Match not found.';
    END IF;

    v_game_state := v_match_record.game_state;

    -- Check if player already in game_state
    v_player_exists := EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_game_state->'players') AS player
        WHERE (player->>'id')::UUID = p_user_id
    );

    IF v_player_exists THEN
        RETURN jsonb_build_object('success', TRUE, 'message', 'Player already in match.');
    END IF;

    -- Add player to game_state.players array
    v_player_state := jsonb_build_object(
        'id', p_user_id,
        'username', p_username,
        'score', 0,
        'isHost', FALSE, -- Newly joined player is not the initial host
        'reactionTime', NULL, -- Specific to reaction-speed
        'hasReacted', FALSE  -- Specific to reaction-speed
    );

    v_updated_game_state := jsonb_set(v_game_state, '{players, -1}', v_player_state, TRUE);

    -- Determine min players based on game type (e.g., Reaction Speed needs 2)
    IF v_match_record.game_type = 'reaction-speed' THEN
        v_min_players := 2; 
    ELSE
        -- Default or other game types
        v_min_players := 2;
    END IF;

    -- Check if match can start (e.g., 2 players for Reaction Speed)
    v_current_players := jsonb_array_elements(v_updated_game_state->'players');
    SELECT COUNT(*) INTO v_num_players FROM jsonb_array_elements(v_updated_game_state->'players');

    IF v_num_players >= v_min_players AND v_updated_game_state->>'status' = 'waiting' THEN
        v_updated_game_state := jsonb_set(v_updated_game_state, '{status}', '"ready"'::jsonb);
        -- For reaction-speed, start countdown immediately if enough players
        IF v_match_record.game_type = 'reaction-speed' THEN
            v_updated_game_state := jsonb_set(v_updated_game_state, '{phase}', '"countdown"'::jsonb);
            v_updated_game_state := jsonb_set(v_updated_game_state, '{countdownStartTime}', to_jsonb(EXTRACT(EPOCH FROM NOW()) * 1000)); -- Current server time in ms
            v_updated_game_state := jsonb_set(v_updated_game_state, '{timerRemaining}', '3'::jsonb); -- 3 second countdown
        END IF;
    END IF;

    -- Update the troll_battles record with the new game_state
    UPDATE public.troll_battles
    SET
        game_state = v_updated_game_state,
        -- Also update player2_id for convenience if it's the second player joining
        player2_id = CASE WHEN v_match_record.player2_id IS NULL AND v_num_players = 2 THEN p_user_id ELSE v_match_record.player2_id END,
        status = (v_updated_game_state->>'status')::TEXT
    WHERE id = p_match_id;

    RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.join_game_match(UUID, UUID, TEXT) TO authenticated, service_role;
