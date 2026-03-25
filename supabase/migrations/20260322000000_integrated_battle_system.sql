-- Integrated Battle System Migration
-- This migration adds support for battles within the broadcast grid

-- 1. Add battle_enabled column to streams table for host preference (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'streams' AND column_name = 'battle_enabled'
  ) THEN
    ALTER TABLE public.streams 
    ADD COLUMN battle_enabled BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 2. Add columns to battles table for integrated battle tracking
ALTER TABLE public.battles 
ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES public.user_profiles(id),
ADD COLUMN IF NOT EXISTS challenger_id UUID REFERENCES public.user_profiles(id),
ADD COLUMN IF NOT EXISTS broadcaster_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS challenger_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sudden_death BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;

-- 3. Create battle_supporters table to track which side each viewer supports
CREATE TABLE IF NOT EXISTS public.battle_supporters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id UUID REFERENCES public.battles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  team TEXT NOT NULL CHECK (team IN ('broadcaster', 'challenger')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(battle_id, user_id)
);

-- 4. Create indexes for battle supporters
CREATE INDEX IF NOT EXISTS idx_battle_supporters_battle ON public.battle_supporters(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_supporters_user ON public.battle_supporters(user_id);

-- 5. Enable RLS on battle_supporters
ALTER TABLE public.battle_supporters ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for battle_supporters
DROP POLICY IF EXISTS "Anyone can read battle supporters" ON public.battle_supporters;
CREATE POLICY "Anyone can read battle supporters" ON public.battle_supporters FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert battle supporters" ON public.battle_supporters;
CREATE POLICY "Authenticated users can insert battle supporters" ON public.battle_supporters FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own battle supporter" ON public.battle_supporters;
CREATE POLICY "Users can update their own battle supporter" ON public.battle_supporters FOR UPDATE USING (auth.uid() = user_id);

-- 7. Create function to start a battle (called by guest)
CREATE OR REPLACE FUNCTION public.start_battle(
  p_stream_id UUID,
  p_challenger_id UUID
) RETURNS UUID AS $$
DECLARE
  v_battle_id UUID;
  v_stream RECORD;
  v_host_id UUID;
BEGIN
  -- Get stream info
  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
  
  IF v_stream IS NULL THEN
    RAISE EXCEPTION 'Stream not found';
  END IF;
  
  v_host_id := v_stream.user_id;
  
  -- Create battle record
  INSERT INTO public.battles (
    host_id,
    challenger_id,
    challenger_stream_id,
    opponent_stream_id,
    status,
    started_at,
    ends_at
  )
  VALUES (
    v_host_id,
    p_challenger_id,
    p_stream_id, -- challenger is the guest's stream (but we're using the same stream)
    p_stream_id, -- same stream for now
    'active',
    now(),
    now() + interval '3 minutes 30 seconds'
  )
  RETURNING id INTO v_battle_id;
  
  -- Notify clients via broadcast
  PERFORM pg_notify(
    'battle_started',
    json_build_object(
      'id', v_battle_id,
      'host_id', v_host_id,
      'challenger_id', p_challenger_id
    )::text
  );
   
  -- Update stream to mark battle as active
  UPDATE public.streams 
  SET battle_id = v_battle_id, is_battle = true, battle_enabled = true
  WHERE id = p_stream_id;
  
  RETURN v_battle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create function to end a battle
CREATE OR REPLACE FUNCTION public.end_battle(
  p_battle_id UUID
) RETURNS void AS $$
DECLARE
  v_battle RECORD;
  v_winner TEXT;
  v_winner_id UUID;
  v_broadcaster_crowns INTEGER := 0;
  v_challenger_crowns INTEGER := 0;
BEGIN
  -- Get battle info
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
  
  IF v_battle IS NULL THEN
    RAISE EXCEPTION 'Battle not found';
  END IF;
  
  -- Determine winner based on scores
  IF v_battle.broadcaster_score > v_battle.challenger_score THEN
    v_winner := 'broadcaster';
    v_winner_id := v_battle.host_id;
    v_broadcaster_crowns := 2;
  ELSIF v_battle.challenger_score > v_battle.broadcaster_score THEN
    v_winner := 'challenger';
    v_winner_id := v_battle.challenger_id;
    v_challenger_crowns := 2;
  ELSE
    v_winner := NULL;
  END IF;
  
  -- Update battle with winner
  UPDATE public.battles 
  SET status = 'ended', 
      ended_at = now(),
      winner_id = v_winner_id
  WHERE id = p_battle_id;
  
  -- Award crowns to winners
  IF v_winner = 'broadcaster' AND v_battle.host_id IS NOT NULL THEN
    UPDATE public.user_profiles 
    SET battle_crowns = battle_crowns + v_broadcaster_crowns
    WHERE id = v_battle.host_id;
  END IF;
  
  IF v_winner = 'challenger' AND v_battle.challenger_id IS NOT NULL THEN
    UPDATE public.user_profiles 
    SET battle_crowns = battle_crowns + v_challenger_crowns
    WHERE id = v_battle.challenger_id;
  END IF;
  
  -- Clear battle from stream
  UPDATE public.streams 
  SET battle_id = NULL, is_battle = false
  WHERE battle_id = p_battle_id;
  
  -- Notify clients via realtime
  PERFORM pg_notify(
    'battle_ended',
    json_build_object(
      'battle_id', p_battle_id,
      'winner', v_winner,
      'broadcaster_score', v_battle.broadcaster_score,
      'challenger_score', v_battle.challenger_score
    )::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create function for viewers to pick a side
CREATE OR REPLACE FUNCTION public.pick_battle_side(
  p_battle_id UUID,
  p_user_id UUID,
  p_team TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO public.battle_supporters (battle_id, user_id, team)
  VALUES (p_battle_id, p_user_id, p_team)
  ON CONFLICT (battle_id, user_id) 
  DO UPDATE SET team = p_team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create function to record a battle gift (for scoring)
CREATE OR REPLACE FUNCTION public.record_battle_gift(
  p_battle_id UUID,
  p_sender_id UUID,
  p_team TEXT,
  p_amount INTEGER
) RETURNS void AS $$
BEGIN
  IF p_team = 'broadcaster' THEN
    UPDATE public.battles 
    SET broadcaster_score = broadcaster_score + p_amount
    WHERE id = p_battle_id;
  ELSIF p_team = 'challenger' THEN
    UPDATE public.battles 
    SET challenger_score = challenger_score + p_amount
    WHERE id = p_battle_id;
  END IF;
  
  -- Check for sudden death (last 10 seconds)
  UPDATE public.battles 
  SET sudden_death = true
  WHERE id = p_battle_id 
    AND ends_at - now() < interval '10 seconds';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Add battle_enabled to app_settings
INSERT INTO public.admin_app_settings (setting_key, setting_value, description)
VALUES ('battle_enabled', 'false', 'Enable battle mode for broadcasts')
ON CONFLICT (setting_key) DO NOTHING;
