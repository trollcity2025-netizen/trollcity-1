CREATE OR REPLACE FUNCTION public.create_game_match(
    p_game_type TEXT,
    p_player_ids UUID[]
) RETURNS UUID AS $$
DECLARE
    v_match_id UUID;
    v_game_state JSONB;
    v_player_states JSONB[] = '{}';
    v_player_id UUID;
    v_username TEXT;
    v_initial_game_state JSONB;
BEGIN
    -- Basic validation for game type
    IF p_game_type NOT IN (
        'reaction-speed', 
        'two-truths-lie', 
        'fame-shame-wheel', 
        'troll-identity-hunt', 
        'multiplayer-solitaire', 
        'multiplayer-dominoes'
    ) THEN
        RAISE EXCEPTION 'Unsupported game type: %s', p_game_type;
    END IF;

    -- Ensure only one player ID is passed for now, as multiplayer logic is not fully developed in RPC
    IF array_length(p_player_ids, 1) IS NULL OR array_length(p_player_ids, 1) != 1 THEN
        RAISE EXCEPTION 'create_game_match currently only supports one player at creation.';
    END IF;

    -- Fetch username for the initial player
    SELECT username INTO v_username FROM public.user_profiles WHERE id = p_player_ids[1];
    IF v_username IS NULL THEN
        RAISE EXCEPTION 'Player with ID %s not found.', p_player_ids[1];
    END IF;

    -- Initialize game_state based on game_type
    -- For 'reaction-speed', the initial state is defined here.
    IF p_game_type = 'reaction-speed' THEN
        v_initial_game_state := jsonb_build_object(
            'matchId', NULL, -- Will be set after INSERT
            'gameType', p_game_type,
            'players', jsonb_build_array(jsonb_build_object(
                'id', p_player_ids[1],
                'username', v_username,
                'score', 0,
                'isHost', TRUE,
                'reactionTime', NULL,
                'hasReacted', FALSE
            )),
            'status', 'pending',
            'phase', 'countdown',
            'timerRemaining', 3, -- Initial countdown for reaction speed
            'triggerTimestamp', NULL,
            'countdownStartTime', NULL
        );
    ELSE
        -- Generic initial state for other games
        v_initial_game_state := jsonb_build_object(
            'matchId', NULL,
            'gameType', p_game_type,
            'players', jsonb_build_array(jsonb_build_object(
                'id', p_player_ids[1],
                'username', v_username,
                'score', 0,
                'isHost', TRUE
            )),
            'status', 'pending'
        );
    END IF;

    -- Insert new match into troll_battles
    INSERT INTO public.troll_battles (host_id, game_type, status, game_state)
    VALUES (p_player_ids[1], p_game_type, 'pending', v_initial_game_state)
    RETURNING id INTO v_match_id;

    -- Update the game_state with the actual matchId
    UPDATE public.troll_battles
    SET
        game_state = jsonb_set(game_state, '{matchId}', to_jsonb(v_match_id))
    WHERE id = v_match_id;

    RETURN v_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_game_match(TEXT, UUID[]) TO authenticated, service_role;
