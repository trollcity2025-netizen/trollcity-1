-- Create battle_participants table
CREATE TABLE IF NOT EXISTS public.battle_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id UUID REFERENCES public.battles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  stream_id UUID REFERENCES public.streams(id), -- The team they are on
  joined_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for battle_participants
ALTER TABLE public.battle_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view battle participants"
ON public.battle_participants FOR SELECT
USING (true);

-- Update accept_battle to include guests
CREATE OR REPLACE FUNCTION public.accept_battle(
  p_battle_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_battle RECORD;
  v_challenger_user_id UUID;
  v_opponent_user_id UUID;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
  
  IF v_battle IS NULL THEN
    RAISE EXCEPTION 'Battle not found';
  END IF;

  UPDATE public.battles 
  SET status = 'active', started_at = now() 
  WHERE id = p_battle_id;

  -- Link both streams to this battle
  UPDATE public.streams 
  SET battle_id = p_battle_id 
  WHERE id IN (v_battle.challenger_stream_id, v_battle.opponent_stream_id);

  -- Get Host User IDs
  SELECT user_id INTO v_challenger_user_id FROM public.streams WHERE id = v_battle.challenger_stream_id;
  SELECT user_id INTO v_opponent_user_id FROM public.streams WHERE id = v_battle.opponent_stream_id;

  -- Insert Hosts as Participants
  INSERT INTO public.battle_participants (battle_id, user_id, stream_id)
  VALUES 
    (p_battle_id, v_challenger_user_id, v_battle.challenger_stream_id),
    (p_battle_id, v_opponent_user_id, v_battle.opponent_stream_id);

  -- Insert Guests (Active Seat Sessions) as Participants
  INSERT INTO public.battle_participants (battle_id, user_id, stream_id)
  SELECT 
    p_battle_id,
    s.user_id,
    s.stream_id
  FROM public.stream_seat_sessions s
  WHERE s.stream_id IN (v_battle.challenger_stream_id, v_battle.opponent_stream_id)
  AND s.status = 'active';

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update distribute_battle_winnings to use battle_participants
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

        -- Get Winner Participants (Hosts + Guests) from battle_participants
        SELECT array_agg(user_id) INTO v_winner_participants 
        FROM battle_participants 
        WHERE battle_id = p_battle_id AND stream_id = v_winner_stream_id;

        -- Fallback: If no participants found (old battles or error), just pay the host
        IF v_winner_participants IS NULL OR array_length(v_winner_participants, 1) = 0 THEN
            v_winner_participants := ARRAY[v_winner_host_id];
        END IF;

        -- Apply Admin Cut (10%) to the POT
        v_admin_cut := floor(v_total_pot * 0.10);
        v_final_pot := v_total_pot - v_admin_cut;

        -- Split evenly
        IF array_length(v_winner_participants, 1) > 0 THEN
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
        END IF;

        RETURN jsonb_build_object('success', true, 'distributed', v_final_pot, 'recipients', array_length(v_winner_participants, 1));
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'Battle not ended or no winner');
END;
$function$;
