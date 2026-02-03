-- Fix missing columns and relationships
ALTER TABLE public.streams 
ADD COLUMN IF NOT EXISTS layout_mode text DEFAULT 'grid';

-- Ensure FK relationship for PostgREST to detect 'user' embedding
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'streams_user_id_fkey_profiles') THEN
    ALTER TABLE public.streams 
    ADD CONSTRAINT streams_user_id_fkey_profiles 
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Add Battle Pot columns
ALTER TABLE public.battles
ADD COLUMN IF NOT EXISTS pot_challenger numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pot_opponent numeric DEFAULT 0;

-- Update spend_coins to handle Battle Pot Logic
CREATE OR REPLACE FUNCTION public.spend_coins(
    p_sender_id uuid,
    p_receiver_id uuid,
    p_coin_amount numeric,
    p_reason text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_sender_balance numeric;
    v_admin_cut numeric;
    v_recipient_amount numeric;
    v_stream_id uuid;
    v_battle_id uuid;
    v_is_battle_active boolean := false;
    v_battle_side text; -- 'challenger' or 'opponent'
BEGIN
    -- 1. Check Balance
    SELECT coins INTO v_sender_balance FROM user_profiles WHERE id = p_sender_id;
    
    IF v_sender_balance IS NULL OR v_sender_balance < p_coin_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
    END IF;

    -- 2. Deduct from Sender
    UPDATE user_profiles 
    SET coins = coins - p_coin_amount 
    WHERE id = p_sender_id;

    -- 3. Determine Context (Battle vs Regular)
    v_stream_id := (p_metadata->>'stream_id')::uuid;
    v_battle_id := (p_metadata->>'battle_id')::uuid;

    -- If stream_id provided, check if it's in a battle
    IF v_battle_id IS NULL AND v_stream_id IS NOT NULL THEN
        SELECT battle_id INTO v_battle_id FROM streams WHERE id = v_stream_id;
    END IF;

    -- If we have a battle_id, check if it's strictly ACTIVE
    IF v_battle_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM battles 
            WHERE id = v_battle_id 
            AND status = 'active'
        ) INTO v_is_battle_active;
    END IF;

    -- 4. Route Funds
    IF v_is_battle_active THEN
        -- BATTLE MODE: Funds go to the Battle Pot (Escrow)
        -- Determine side
        SELECT 
            CASE 
                WHEN challenger_stream_id = v_stream_id OR (SELECT user_id FROM streams WHERE id = challenger_stream_id) = p_receiver_id THEN 'challenger'
                WHEN opponent_stream_id = v_stream_id OR (SELECT user_id FROM streams WHERE id = opponent_stream_id) = p_receiver_id THEN 'opponent'
                ELSE NULL
            END INTO v_battle_side
        FROM battles WHERE id = v_battle_id;

        IF v_battle_side = 'challenger' THEN
            UPDATE battles 
            SET pot_challenger = pot_challenger + p_coin_amount,
                score_challenger = score_challenger + p_coin_amount
            WHERE id = v_battle_id;
        ELSIF v_battle_side = 'opponent' THEN
            UPDATE battles 
            SET pot_opponent = pot_opponent + p_coin_amount,
                score_opponent = score_opponent + p_coin_amount
            WHERE id = v_battle_id;
        ELSE
            -- Fallback if side undetermined: Treat as normal gift (shouldn't happen ideally)
            v_is_battle_active := false;
        END IF;
    END IF;

    IF NOT v_is_battle_active THEN
        -- NORMAL MODE: Immediate Transfer with Admin Cut
        v_admin_cut := p_coin_amount * 0.10;
        v_recipient_amount := p_coin_amount - v_admin_cut;

        -- Credit Receiver
        UPDATE user_profiles 
        SET coins = coins + v_recipient_amount 
        WHERE id = p_receiver_id;

        -- Credit Admin (Bank)
        -- Assuming there's a specific admin account or just burnt/tracked elsewhere
        -- For now, we just don't mint it to anyone else, effectively burning it from circulation 
        -- or we can add to a 'bank' profile if one exists.
        -- UPDATE user_profiles SET coins = coins + v_admin_cut WHERE id = 'admin-uuid'; 
    END IF;

    -- 5. Record Transaction Log (Ledger)
    INSERT INTO coin_ledger (user_id, amount, transaction_type, reason, metadata)
    VALUES 
        (p_sender_id, -p_coin_amount, 'expense', p_reason, p_metadata);

    IF NOT v_is_battle_active THEN
        INSERT INTO coin_ledger (user_id, amount, transaction_type, reason, metadata)
        VALUES 
            (p_receiver_id, v_recipient_amount, 'income', p_reason, p_metadata);
    END IF;

    -- 6. Record Gift History
    IF v_stream_id IS NOT NULL THEN
        INSERT INTO stream_gifts (stream_id, sender_id, recipient_id, gift_id, amount, battle_id)
        VALUES (
            v_stream_id, 
            p_sender_id, 
            p_receiver_id, 
            (p_metadata->>'gift_id')::uuid, 
            p_coin_amount,
            CASE WHEN v_is_battle_active THEN v_battle_id ELSE NULL END
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'new_balance', v_sender_balance - p_coin_amount);
END;
$function$;

-- Create Function to Distribute Battle Winnings
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
    v_winner_host_id uuid;
    v_participants uuid[];
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
            v_total_pot := v_battle.pot_challenger + v_battle.pot_opponent; -- Winner takes ALL
        ELSE
            v_winner_stream_id := v_battle.opponent_stream_id;
            v_total_pot := v_battle.pot_challenger + v_battle.pot_opponent;
        END IF;

        -- Identify Participants (Host + Guests on winning stream)
        -- Get Host
        SELECT user_id INTO v_winner_host_id FROM streams WHERE id = v_winner_stream_id;
        
        -- Get Guests (accepted/joined)
        SELECT array_agg(user_id) INTO v_participants 
        FROM stream_guests 
        WHERE stream_id = v_winner_stream_id AND status = 'accepted';

        -- Combine
        IF v_participants IS NULL THEN
            v_participants := ARRAY[v_winner_host_id];
        ELSE
            v_participants := array_append(v_participants, v_winner_host_id);
        END IF;

        -- Apply Admin Cut (10%) to the POT
        v_admin_cut := v_total_pot * 0.10;
        v_final_pot := v_total_pot - v_admin_cut;

        -- Split evenly
        v_share_per_person := floor(v_final_pot / array_length(v_participants, 1));

        -- Distribute
        UPDATE user_profiles
        SET coins = coins + v_share_per_person
        WHERE id = ANY(v_participants);

        -- Log Ledger
        INSERT INTO coin_ledger (user_id, amount, transaction_type, reason, metadata)
        SELECT 
            u_id, 
            v_share_per_person, 
            'income', 
            'battle_win', 
            jsonb_build_object('battle_id', p_battle_id, 'role', 'winner')
        FROM unnest(v_participants) AS u_id;

        RETURN jsonb_build_object('success', true, 'distributed', v_final_pot, 'recipients', array_length(v_participants, 1));
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'Battle not ended or no winner');
END;
$function$;
