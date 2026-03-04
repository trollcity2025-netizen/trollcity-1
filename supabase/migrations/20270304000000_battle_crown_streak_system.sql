-- Battle Crown and Streak System
-- Adds crown tracking and win streaks for broadcasters

-- Add crown columns to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS battle_crowns INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS battle_crown_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_battle_win_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_battle_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_battles INTEGER DEFAULT 0;

-- Add battle result tracking
ALTER TABLE public.battles
ADD COLUMN IF NOT EXISTS challenger_crowns_before INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS opponent_crowns_before INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS challenger_streak_before INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS opponent_streak_before INTEGER DEFAULT 0;

-- Create index for crown streak lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_crown_streak ON public.user_profiles(battle_crown_streak DESC) WHERE battle_crown_streak > 0;
CREATE INDEX IF NOT EXISTS idx_user_profiles_battle_crowns ON public.user_profiles(battle_crowns DESC) WHERE battle_crowns > 0;

-- Function to update crown and streak after battle ends
CREATE OR REPLACE FUNCTION public.update_battle_crowns_and_streak(
    p_winner_id UUID,
    p_loser_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_winner_crowns INTEGER;
    v_winner_streak INTEGER;
    v_loser_crowns INTEGER;
    v_loser_streak INTEGER;
    v_result JSONB;
BEGIN
    -- Get current values for winner
    SELECT battle_crowns, battle_crown_streak 
    INTO v_winner_crowns, v_winner_streak
    FROM public.user_profiles 
    WHERE id = p_winner_id;
    
    -- Get current values for loser
    SELECT battle_crowns, battle_crown_streak 
    INTO v_loser_crowns, v_loser_streak
    FROM public.user_profiles 
    WHERE id = p_loser_id;
    
    -- Update winner: increment crowns and streak
    UPDATE public.user_profiles
    SET 
        battle_crowns = battle_crowns + 1,
        battle_crown_streak = battle_crown_streak + 1,
        total_battle_wins = total_battle_wins + 1,
        total_battles = total_battles + 1,
        last_battle_win_at = NOW()
    WHERE id = p_winner_id;
    
    -- Update loser: reduce crowns one by one, reset streak
    UPDATE public.user_profiles
    SET 
        battle_crowns = GREATEST(0, battle_crowns - 1),
        battle_crown_streak = 0,
        total_battles = total_battles + 1
    WHERE id = p_loser_id;
    
    -- Build result
    v_result := jsonb_build_object(
        'winner', jsonb_build_object(
            'id', p_winner_id,
            'crowns_before', v_winner_crowns,
            'crowns_after', v_winner_crowns + 1,
            'streak_before', v_winner_streak,
            'streak_after', v_winner_streak + 1,
            'has_streak', (v_winner_streak + 1) >= 3
        ),
        'loser', jsonb_build_object(
            'id', p_loser_id,
            'crowns_before', v_loser_crowns,
            'crowns_after', GREATEST(0, v_loser_crowns - 1),
            'streak_before', v_loser_streak,
            'streak_after', 0,
            'streak_broken', v_loser_streak > 0
        )
    );
    
    RETURN v_result;
END;
$$;

-- Function to check if user has active streak (3+ wins)
CREATE OR REPLACE FUNCTION public.has_crown_streak(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_streak INTEGER;
BEGIN
    SELECT battle_crown_streak INTO v_streak
    FROM public.user_profiles
    WHERE id = p_user_id;
    
    RETURN COALESCE(v_streak, 0) >= 3;
END;
$$;

-- Function to get crown display info for a user
CREATE OR REPLACE FUNCTION public.get_crown_display_info(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile RECORD;
    v_result JSONB;
BEGIN
    SELECT battle_crowns, battle_crown_streak, total_battle_wins, total_battles
    INTO v_profile
    FROM public.user_profiles
    WHERE id = p_user_id;
    
    IF v_profile IS NULL THEN
        RETURN jsonb_build_object(
            'crowns', 0,
            'streak', 0,
            'has_streak', false,
            'total_wins', 0,
            'total_battles', 0
        );
    END IF;
    
    RETURN jsonb_build_object(
        'crowns', COALESCE(v_profile.battle_crowns, 0),
        'streak', COALESCE(v_profile.battle_crown_streak, 0),
        'has_streak', COALESCE(v_profile.battle_crown_streak, 0) >= 3,
        'total_wins', COALESCE(v_profile.total_battle_wins, 0),
        'total_battles', COALESCE(v_profile.total_battles, 0)
    );
END;
$$;

-- Function to troll opponent (deduct 1% coins during sudden death)
CREATE OR REPLACE FUNCTION public.troll_opponent(
    p_battle_id UUID,
    p_troller_id UUID,
    p_target_stream_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_battle RECORD;
    v_troller_team TEXT;
    v_target_user_id UUID;
    v_target_coins NUMERIC;
    v_deduction_amount NUMERIC;
    v_is_sudden_death BOOLEAN;
    v_time_left INTEGER;
BEGIN
    -- Get battle info
    SELECT * INTO v_battle
    FROM public.battles
    WHERE id = p_battle_id;
    
    IF v_battle IS NULL OR v_battle.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Battle not found or not active');
    END IF;
    
    -- Determine which team the troller is on
    IF EXISTS (SELECT 1 FROM public.streams WHERE id = v_battle.challenger_stream_id AND user_id = p_troller_id) THEN
        v_troller_team := 'challenger';
    ELSIF EXISTS (SELECT 1 FROM public.streams WHERE id = v_battle.opponent_stream_id AND user_id = p_troller_id) THEN
        v_troller_team := 'opponent';
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'User is not a broadcaster in this battle');
    END IF;
    
    -- Verify target is opponent's stream
    IF v_troller_team = 'challenger' AND p_target_stream_id != v_battle.opponent_stream_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Can only troll the opponent');
    END IF;
    IF v_troller_team = 'opponent' AND p_target_stream_id != v_battle.challenger_stream_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Can only troll the opponent');
    END IF;
    
    -- Check if in sudden death (last 10 seconds)
    IF v_battle.started_at IS NOT NULL THEN
        v_time_left := 180 - EXTRACT(EPOCH FROM (NOW() - v_battle.started_at))::INTEGER;
        v_is_sudden_death := v_time_left <= 10 AND v_time_left > 0;
    ELSE
        v_is_sudden_death := false;
    END IF;
    
    IF NOT v_is_sudden_death THEN
        RETURN jsonb_build_object('success', false, 'message', 'Troll button only available during sudden death');
    END IF;
    
    -- Get target user ID
    SELECT user_id INTO v_target_user_id
    FROM public.streams
    WHERE id = p_target_stream_id;
    
    IF v_target_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Target stream not found');
    END IF;
    
    -- Get target's current coins
    SELECT troll_coins INTO v_target_coins
    FROM public.user_profiles
    WHERE id = v_target_user_id;
    
    IF COALESCE(v_target_coins, 0) <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Target has no coins to troll');
    END IF;
    
    -- Calculate 1% deduction (minimum 1 coin)
    v_deduction_amount := GREATEST(1, CEIL(v_target_coins * 0.01));
    
    -- Deduct coins from target
    UPDATE public.user_profiles
    SET troll_coins = GREATEST(0, troll_coins - v_deduction_amount)
    WHERE id = v_target_user_id;
    
    -- Add deduction to troller's score (as a gift)
    IF v_troller_team = 'challenger' THEN
        UPDATE public.battles
        SET score_challenger = score_challenger + v_deduction_amount
        WHERE id = p_battle_id;
    ELSE
        UPDATE public.battles
        SET score_opponent = score_opponent + v_deduction_amount
        WHERE id = p_battle_id;
    END IF;
    
    -- Log the troll action
    INSERT INTO public.battle_events (
        battle_id,
        event_type,
        user_id,
        target_user_id,
        amount,
        metadata
    ) VALUES (
        p_battle_id,
        'troll',
        p_troller_id,
        v_target_user_id,
        v_deduction_amount,
        jsonb_build_object(
            'troller_team', v_troller_team,
            'target_coins_before', v_target_coins,
            'is_sudden_death', true
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Troll successful!',
        'deduction', v_deduction_amount,
        'target_coins_before', v_target_coins,
        'target_coins_after', v_target_coins - v_deduction_amount
    );
END;
$$;

-- Create battle_events table if not exists
CREATE TABLE IF NOT EXISTS public.battle_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'troll', 'sudden_death_start', 'guest_join', 'guest_leave', etc.
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    amount NUMERIC DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on battle_events
ALTER TABLE public.battle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read battle events" ON public.battle_events
    FOR SELECT USING (true);

CREATE POLICY "Authenticated insert battle events" ON public.battle_events
    FOR INSERT WITH CHECK (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.battles b
        WHERE b.id = battle_id
        AND (EXISTS (SELECT 1 FROM public.streams s WHERE s.id = b.challenger_stream_id AND s.user_id = auth.uid())
             OR EXISTS (SELECT 1 FROM public.streams s WHERE s.id = b.opponent_stream_id AND s.user_id = auth.uid()))
    ));

-- Create index for battle events
CREATE INDEX IF NOT EXISTS idx_battle_events_battle_id ON public.battle_events(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_events_created_at ON public.battle_events(created_at DESC);

-- Function to handle guest leaving during battle
CREATE OR REPLACE FUNCTION public.handle_battle_guest_leave(
    p_battle_id UUID,
    p_guest_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_participant RECORD;
    v_stream_id UUID;
    v_current_box_count INTEGER;
    v_new_box_count INTEGER;
BEGIN
    -- Get participant info
    SELECT * INTO v_participant
    FROM public.battle_participants
    WHERE battle_id = p_battle_id AND user_id = p_guest_user_id;
    
    IF v_participant IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Guest not found in battle');
    END IF;
    
    -- Mark participant as left
    UPDATE public.battle_participants
    SET 
        role = 'viewer',
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('left_at', NOW(), 'was_stage', true)
    WHERE battle_id = p_battle_id AND user_id = p_guest_user_id;
    
    -- Get the source stream to update box count
    v_stream_id := v_participant.source_stream_id;
    
    -- Get current box count
    SELECT box_count INTO v_current_box_count
    FROM public.streams
    WHERE id = v_stream_id;
    
    -- Auto-decrement box count (but keep at least 1)
    v_new_box_count := GREATEST(1, COALESCE(v_current_box_count, 1) - 1);
    
    UPDATE public.streams
    SET box_count = v_new_box_count
    WHERE id = v_stream_id;
    
    -- Log the event
    INSERT INTO public.battle_events (
        battle_id,
        event_type,
        user_id,
        metadata
    ) VALUES (
        p_battle_id,
        'guest_leave',
        p_guest_user_id,
        jsonb_build_object(
            'team', v_participant.team,
            'seat_index', v_participant.seat_index,
            'stream_id', v_stream_id,
            'box_count_before', v_current_box_count,
            'box_count_after', v_new_box_count
        )
    );
    
    -- Broadcast the box count change via realtime
    PERFORM pg_notify('box_count_changed', jsonb_build_object(
        'stream_id', v_stream_id,
        'box_count', v_new_box_count,
        'battle_id', p_battle_id,
        'guest_left', p_guest_user_id
    )::text);
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Guest left battle',
        'box_count_updated', v_new_box_count != v_current_box_count,
        'new_box_count', v_new_box_count
    );
END;
$$;

-- Add realtime publication for battle_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_events;

COMMENT ON TABLE public.battle_events IS 'Tracks events during battles including trolls, guest joins/leaves, and sudden death';
COMMENT ON COLUMN public.user_profiles.battle_crowns IS 'Total battle crowns earned by user';
COMMENT ON COLUMN public.user_profiles.battle_crown_streak IS 'Current consecutive battle wins (resets on loss)';
COMMENT ON COLUMN public.user_profiles.last_battle_win_at IS 'Timestamp of last battle win';