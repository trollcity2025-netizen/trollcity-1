-- Migration: Create RPC functions for Internet Games
-- Created: 2026-03-04

-- Function to create a new internet game match
CREATE OR REPLACE FUNCTION public.create_internet_game_match(
    p_game_type TEXT,
    p_player_ids UUID[]
) RETURNS UUID AS $$
DECLARE
    v_match_id UUID;
    v_game_state JSONB;
    v_username TEXT;
    v_initial_game_state JSONB;
BEGIN
    -- Validate game type for internet games
    IF p_game_type NOT IN ('snake', 'pong', 'tetris', 'pacman') THEN
        RAISE EXCEPTION 'Unsupported internet game type: %s', p_game_type;
    END IF;

    -- Ensure only one player ID is passed at creation
    IF array_length(p_player_ids, 1) IS NULL OR array_length(p_player_ids, 1) != 1 THEN
        RAISE EXCEPTION 'create_internet_game_match currently only supports one player at creation.';
    END IF;

    -- Fetch username for the initial player
    SELECT username INTO v_username FROM public.user_profiles WHERE id = p_player_ids[1];
    IF v_username IS NULL THEN
        RAISE EXCEPTION 'Player with ID %s not found.', p_player_ids[1];
    END IF;

    -- Initialize game_state based on game type
    -- The game state structure will be further initialized by the client-side game engine
    v_initial_game_state := jsonb_build_object(
        'matchId', NULL,
        'gameType', p_game_type,
        'players', jsonb_build_array(jsonb_build_object(
            'id', p_player_ids[1],
            'username', v_username,
            'score', 0,
            'isHost', TRUE,
            'isConnected', TRUE
        )),
        'status', 'pending',
        'phase', 'waiting',
        'timerRemaining', 0,
        'startTime', NULL,
        'endTime', NULL
    );

    -- Add game-specific initial state
    IF p_game_type = 'snake' THEN
        v_initial_game_state := v_initial_game_state || jsonb_build_object(
            'gridSize', jsonb_build_object('width', 30, 'height', 20),
            'food', jsonb_build_object('x', 15, 'y', 10),
            'gameLoopInterval', 100
        );
    ELSIF p_game_type = 'pong' THEN
        v_initial_game_state := v_initial_game_state || jsonb_build_object(
            'canvasWidth', 800,
            'canvasHeight', 400,
            'ball', jsonb_build_object('x', 400, 'y', 200, 'dx', 5, 'dy', 5, 'speed', 5),
            'winningScore', 10
        );
    ELSIF p_game_type = 'tetris' THEN
        v_initial_game_state := v_initial_game_state || jsonb_build_object(
            'gridWidth', 10,
            'gridHeight', 20,
            'board', '[]'::jsonb,
            'nextPiece', NULL,
            'linesCleared', 0,
            'level', 1
        );
    END IF;

    -- Insert new match into troll_battles
    INSERT INTO public.troll_battles (host_id, game_type, status, game_state, battle_type)
    VALUES (p_player_ids[1], p_game_type, 'pending', v_initial_game_state, 'game')
    RETURNING id INTO v_match_id;

    -- Update the game_state with the actual matchId
    UPDATE public.troll_battles
    SET
        game_state = jsonb_set(game_state, '{matchId}', to_jsonb(v_match_id))
    WHERE id = v_match_id;

    RETURN v_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_internet_game_match(TEXT, UUID[]) TO authenticated, service_role;

-- Add comment for documentation
COMMENT ON FUNCTION public.create_internet_game_match(TEXT, UUID[]) IS 'Creates a new internet game match for games like Snake, Pong, and Tetris.';
