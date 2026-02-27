CREATE OR REPLACE FUNCTION public.process_game_action(
    p_match_id UUID,
    p_user_id UUID,
    p_action_type TEXT,
    p_payload JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    v_match_record public.troll_battles;
    v_game_state JSONB;
    v_player_found BOOLEAN := FALSE;
    v_current_timestamp BIGINT := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
    v_updated_game_state JSONB;
    v_winner_id UUID;
BEGIN
    -- Fetch the current match record and lock it for update
    SELECT * INTO v_match_record FROM public.troll_battles WHERE id = p_match_id FOR UPDATE;

    IF v_match_record IS NULL THEN
        RAISE EXCEPTION 'Match not found.';
    END IF;

    v_game_state := v_match_record.game_state;

    -- Validate player is part of the match
    IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_game_state->'players') AS player
        WHERE (player->>'id')::UUID = p_user_id
    ) THEN
        RAISE EXCEPTION 'Player %s is not part of match %s.', p_user_id, p_match_id;
    END IF;

    -- General match status validation
    IF v_game_state->>'status' != 'active' AND v_game_state->>'status' != 'ready' THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Match is not active or ready.');
    END IF;

    -- Apply game-specific action logic
    IF v_match_record.game_type = 'reaction-speed' THEN
        IF p_action_type = 'react_to_trigger' THEN
            -- Validate game phase
            IF v_game_state->>'phase' != 'waiting_for_reaction' THEN
                RETURN jsonb_build_object('success', FALSE, 'message', 'Not in reaction phase.');
            END IF;

            -- Validate if player has already reacted
            IF EXISTS (
                SELECT 1 FROM jsonb_array_elements(v_game_state->'players') AS player
                WHERE (player->>'id')::UUID = p_user_id AND (player->>'hasReacted')::BOOLEAN = TRUE
            ) THEN
                RETURN jsonb_build_object('success', FALSE, 'message', 'Player already reacted.');
            END IF;

            -- Record reaction
            v_updated_game_state := jsonb_set(
                v_game_state,
                ARRAY['players', (SELECT idx::text FROM jsonb_array_elements(v_game_state->'players') WITH ORDINALITY arr(player, idx) WHERE (player->>'id')::UUID = p_user_id)-1::text, 'reactionTime'],
                to_jsonb(v_current_timestamp - (v_game_state->>'triggerTimestamp')::BIGINT)
            );
            v_updated_game_state := jsonb_set(
                v_updated_game_state,
                ARRAY['players', (SELECT idx::text FROM jsonb_array_elements(v_game_state->'players') WITH ORDINALITY arr(player, idx) WHERE (player->>'id')::UUID = p_user_id)-1::text, 'hasReacted'],
                'true'::jsonb
            );

            -- Check if all active players have reacted or if reaction window has passed (handled by timer)
            -- For now, we only update the player's reaction.
            -- The game state will be advanced by a timer-based function or when all players react.

        ELSIF p_action_type = 'update_timer_and_state' THEN
            -- This action is expected to be called by a trusted source (e.g., MatchController on client or a server function)
            -- It updates the game state based on elapsed time and phase transitions
            -- This simulates the GameEngine.updateState function in the DB
            
            -- Re-evaluate game state based on current time
            IF v_game_state->>'phase' = 'countdown' AND (v_game_state->>'countdownStartTime')::BIGINT + 3000 <= v_current_timestamp THEN
                -- Countdown finished, transition to waiting_for_reaction
                v_updated_game_state := jsonb_set(v_game_state, '{phase}', '"waiting_for_reaction"'::jsonb);
                v_updated_game_state := jsonb_set(v_updated_game_state, '{triggerTimestamp}', to_jsonb(v_current_timestamp + (FLOOR(RANDOM() * (5000 - 2000 + 1)) + 2000)::BIGINT)); -- Random trigger between 2-5 seconds
                v_updated_game_state := jsonb_set(v_updated_game_state, '{timerRemaining}', '5'::jsonb); -- Max 5 seconds until trigger

            ELSIF v_game_state->>'phase' = 'waiting_for_reaction' AND (v_game_state->>'triggerTimestamp')::BIGINT + 1000 <= v_current_timestamp THEN
                -- Reaction window ended, determine winner
                v_updated_game_state := v_game_state; -- Start with current state

                -- Determine fastest reaction
                DECLARE
                    fastest_time BIGINT := NULL;
                    current_player_reaction_time BIGINT;
                    p_id UUID;
                BEGIN
                    FOR p_id IN SELECT (player->>'id')::UUID FROM jsonb_array_elements(v_game_state->'players') AS player
                    LOOP
                        current_player_reaction_time := (SELECT (player->>'reactionTime')::BIGINT FROM jsonb_array_elements(v_game_state->'players') AS player WHERE (player->>'id')::UUID = p_id);
                        IF current_player_reaction_time IS NOT NULL THEN
                            IF fastest_time IS NULL OR current_player_reaction_time < fastest_time THEN
                                fastest_time := current_player_reaction_time;
                                v_winner_id := p_id;
                            END IF;
                        END IF;
                    END LOOP;
                END;

                -- Set winner and update status
                IF v_winner_id IS NOT NULL THEN
                    v_updated_game_state := jsonb_set(v_updated_game_state, '{winnerId}', to_jsonb(v_winner_id));
                    v_updated_game_state := jsonb_set(v_updated_game_state, '{status}', '"finished"'::jsonb);
                    v_updated_game_state := jsonb_set(v_updated_game_state, '{phase}', '"finished"'::jsonb);
                    v_updated_game_state := jsonb_set(v_updated_game_state, '{timerRemaining}', '0'::jsonb);
                ELSE
                    -- No winner (e.g., no one reacted), can be a draw or no reward
                    v_updated_game_state := jsonb_set(v_updated_game_state, '{status}', '"finished"'::jsonb);
                    v_updated_game_state := jsonb_set(v_updated_game_state, '{phase}', '"finished"'::jsonb);
                    v_updated_game_state := jsonb_set(v_updated_game_state, '{timerRemaining}', '0'::jsonb);
                END IF;

            ELSE
                -- No state change based on timer, just update timer remaining for countdown
                IF v_game_state->>'phase' = 'countdown' THEN
                    v_updated_game_state := jsonb_set(v_game_state, '{timerRemaining}', to_jsonb(GREATEST(0, CEIL(((v_game_state->>'countdownStartTime')::BIGINT + 3000 - v_current_timestamp) / 1000.0))));
                ELSIF v_game_state->>'phase' = 'waiting_for_reaction' AND (v_game_state->>'triggerTimestamp')::BIGINT IS NOT NULL THEN
                    IF v_current_timestamp < (v_game_state->>'triggerTimestamp')::BIGINT THEN
                         -- Time until trigger
                        v_updated_game_state := jsonb_set(v_game_state, '{timerRemaining}', to_jsonb(GREATEST(0, CEIL(((v_game_state->>'triggerTimestamp')::BIGINT - v_current_timestamp) / 1000.0))));
                    ELSE
                         -- Time within reaction window
                        v_updated_game_state := jsonb_set(v_game_state, '{timerRemaining}', to_jsonb(GREATEST(0, CEIL(((v_game_state->>'triggerTimestamp')::BIGINT + 1000 - v_current_timestamp) / 1000.0))));
                    END IF;
                END IF;
            END IF;
        ELSE
            RAISE EXCEPTION 'Unsupported action type for reaction-speed: %s', p_action_type;
        END IF;
    ELSE
        RAISE EXCEPTION 'Unsupported game type: %s', v_match_record.game_type;
    END IF;

    -- Update the troll_battles record with the new game_state
    UPDATE public.troll_battles
    SET
        game_state = COALESCE(v_updated_game_state, v_game_state),
        status = COALESCE(v_updated_game_state->>'status', v_game_state->>'status')::TEXT,
        winner_id = COALESCE((v_updated_game_state->>'winnerId')::UUID, v_match_record.winner_id)
    WHERE id = p_match_id;

    -- If winner determined, call set_match_winner RPC (already exists and handles awarding coins)
    IF (v_updated_game_state->>'winnerId')::UUID IS NOT NULL AND v_match_record.winner_id IS NULL THEN
        PERFORM public.set_match_winner(p_match_id, (v_updated_game_state->>'winnerId')::UUID);
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'game_state', COALESCE(v_updated_game_state, v_game_state));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.process_game_action(UUID, UUID, TEXT, JSONB) TO authenticated, service_role;
