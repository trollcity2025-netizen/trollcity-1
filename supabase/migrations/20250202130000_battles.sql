-- Create battles table
CREATE TABLE IF NOT EXISTS public.battles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_stream_id UUID REFERENCES public.streams(id) NOT NULL,
  opponent_stream_id UUID REFERENCES public.streams(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended')),
  winner_stream_id UUID REFERENCES public.streams(id),
  score_challenger INTEGER DEFAULT 0,
  score_opponent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- Add battle_id to streams to easily check if a stream is in a battle
ALTER TABLE public.streams 
ADD COLUMN IF NOT EXISTS battle_id UUID REFERENCES public.battles(id);

-- RPC to create a battle challenge
CREATE OR REPLACE FUNCTION public.create_battle_challenge(
  p_challenger_id UUID,
  p_opponent_id UUID
) RETURNS UUID AS $$
DECLARE
  v_battle_id UUID;
BEGIN
  INSERT INTO public.battles (challenger_stream_id, opponent_stream_id)
  VALUES (p_challenger_id, p_opponent_id)
  RETURNING id INTO v_battle_id;
  
  RETURN v_battle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to accept battle
CREATE OR REPLACE FUNCTION public.accept_battle(
  p_battle_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_battle RECORD;
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

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to end battle
CREATE OR REPLACE FUNCTION public.end_battle(
  p_battle_id UUID,
  p_winner_stream_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.battles 
  SET status = 'ended', ended_at = now(), winner_stream_id = p_winner_stream_id
  WHERE id = p_battle_id;

  -- Unlink streams
  UPDATE public.streams 
  SET battle_id = NULL 
  WHERE battle_id = p_battle_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
