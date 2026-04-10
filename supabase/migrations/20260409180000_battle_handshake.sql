-- Battle Handshake System - Ensures BOTH broadcasters are on battle screen before countdown starts
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS countdown_started BOOLEAN DEFAULT false;
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS battle_handshake TEXT DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.initiate_battle_handshake(host_stream_id TEXT, opponent_stream_id TEXT)
RETURNS JSONB AS $$
DECLARE
  new_battle_id TEXT;
BEGIN
  -- Create pending handshake battle
  INSERT INTO public.battles (
    stream_id, 
    opponent_stream_id, 
    status, 
    host_ready, 
    opponent_ready, 
    countdown_started
  ) VALUES (
    host_stream_id, 
    opponent_stream_id, 
    'handshake', 
    false, 
    false, 
    false
  ) RETURNING id INTO new_battle_id;

  -- Mark both streams as in handshake
  UPDATE public.streams SET battle_handshake = new_battle_id WHERE id IN (host_stream_id, opponent_stream_id);

  RETURN jsonb_build_object('battle_id', new_battle_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.confirm_battle_screen(battle_id_input TEXT, user_id_input UUID)
RETURNS JSONB AS $$
DECLARE
  battle_rec RECORD;
  host_confirmed BOOLEAN;
  opponent_confirmed BOOLEAN;
BEGIN
  SELECT * INTO battle_rec FROM public.battles WHERE id = battle_id_input;
  
  IF battle_rec.host_id = user_id_input THEN
    UPDATE public.battles SET host_ready = true WHERE id = battle_id_input;
  ELSIF battle_rec.opponent_id = user_id_input THEN
    UPDATE public.battles SET opponent_ready = true WHERE id = battle_id_input;
  END IF;

  SELECT host_ready, opponent_ready INTO host_confirmed, opponent_confirmed 
  FROM public.battles WHERE id = battle_id_input;

  -- BOTH confirmed - START COUNTDOWN NOW
  IF host_confirmed AND opponent_confirmed AND NOT battle_rec.countdown_started THEN
    UPDATE public.battles SET 
      countdown_started = true,
      scheduled_start_at = NOW() + INTERVAL '10 seconds',
      status = 'pending'
    WHERE id = battle_id_input;

    -- Clear handshake flags
    UPDATE public.streams SET 
      battle_handshake = NULL,
      is_battle = true,
      battle_id = battle_id_input
    WHERE id IN (battle_rec.stream_id, battle_rec.opponent_stream_id);

    RETURN jsonb_build_object(
      'countdown_started', true,
      'start_time', NOW() + INTERVAL '10 seconds'
    );
  END IF;

  RETURN jsonb_build_object(
    'countdown_started', false,
    'host_confirmed', host_confirmed,
    'opponent_confirmed', opponent_confirmed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.initiate_battle_handshake(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_battle_screen(TEXT, UUID) TO authenticated;