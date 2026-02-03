-- Add Battle Stats to User Profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS battle_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS battle_losses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS battle_draws INTEGER DEFAULT 0;

-- Update distribute_battle_winnings to handle stats and correct currency (troll_coins)
CREATE OR REPLACE FUNCTION public.distribute_battle_winnings(
    p_battle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_battle RECORD;
    v_total_pot numeric;
    v_winner_stream_id uuid;
    v_loser_stream_id uuid;
    v_winner_host_id uuid;
    v_loser_host_id uuid;
    v_winner_participants uuid[];
    v_share_per_person numeric;
    v_admin_cut numeric;
    v_final_pot numeric;
BEGIN
    -- Get Battle Info
    SELECT * INTO v_battle FROM battles WHERE id = p_battle_id;
    
    IF v_battle.status = 'ended' AND v_battle.winner_id IS NOT NULL THEN
        -- Determine Winner Side
        IF v_battle.score_challenger > v_battle.score_opponent THEN
            v_winner_stream_id := v_battle.challenger_stream_id;
            v_loser_stream_id := v_battle.opponent_stream_id;
            v_total_pot := COALESCE(v_battle.pot_challenger, 0) + COALESCE(v_battle.pot_opponent, 0);
        ELSE
            v_winner_stream_id := v_battle.opponent_stream_id;
            v_loser_stream_id := v_battle.challenger_stream_id;
            v_total_pot := COALESCE(v_battle.pot_challenger, 0) + COALESCE(v_battle.pot_opponent, 0);
        END IF;

        -- Identify Hosts
        SELECT user_id INTO v_winner_host_id FROM streams WHERE id = v_winner_stream_id;
        SELECT user_id INTO v_loser_host_id FROM streams WHERE id = v_loser_stream_id;
        
        -- Update Host Stats (Wins/Losses)
        UPDATE user_profiles SET battle_wins = battle_wins + 1 WHERE id = v_winner_host_id;
        UPDATE user_profiles SET battle_losses = battle_losses + 1 WHERE id = v_loser_host_id;

        -- Get Winner Guests (accepted/joined)
        SELECT array_agg(user_id) INTO v_winner_participants 
        FROM stream_guests 
        WHERE stream_id = v_winner_stream_id AND status = 'accepted';

        -- Combine Winner Participants for Pot
        IF v_winner_participants IS NULL THEN
            v_winner_participants := ARRAY[v_winner_host_id];
        ELSE
            v_winner_participants := array_append(v_winner_participants, v_winner_host_id);
        END IF;

        -- Apply Admin Cut (10%) to the POT
        v_admin_cut := floor(v_total_pot * 0.10);
        v_final_pot := v_total_pot - v_admin_cut;

        -- Split evenly
        v_share_per_person := floor(v_final_pot / array_length(v_winner_participants, 1));

        -- Distribute Pot (using troll_coins)
        IF v_share_per_person > 0 THEN
            UPDATE user_profiles
            SET troll_coins = troll_coins + v_share_per_person
            WHERE id = ANY(v_winner_participants);

            -- Log Ledger
            INSERT INTO coin_ledger (user_id, amount, transaction_type, reason, metadata)
            SELECT 
                u_id, 
                v_share_per_person, 
                'income', 
                'battle_win', 
                jsonb_build_object('battle_id', p_battle_id, 'role', 'winner')
            FROM unnest(v_winner_participants) AS u_id;
        END IF;

        RETURN jsonb_build_object('success', true, 'distributed', v_final_pot, 'recipients', array_length(v_winner_participants, 1));
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'Battle not ended or no winner');
END;
$function$;
