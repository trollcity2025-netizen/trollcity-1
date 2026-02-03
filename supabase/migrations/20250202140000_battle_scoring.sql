-- Update send_gift to handle Battle Scoring
CREATE OR REPLACE FUNCTION public.send_gift(
  p_stream_id UUID,
  p_recipient_id UUID,
  p_gift_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_gift_cost INTEGER;
  v_sender_id UUID;
  v_sender_balance INTEGER;
  v_host_cut INTEGER;
  v_admin_cut INTEGER;
  v_battle_id UUID;
  v_is_challenger BOOLEAN;
BEGIN
  -- Get current user (sender)
  v_sender_id := auth.uid();
  
  -- Get gift cost
  SELECT cost INTO v_gift_cost FROM public.gifts WHERE id = p_gift_id;
  IF v_gift_cost IS NULL THEN
    RAISE EXCEPTION 'Gift not found';
  END IF;

  -- Check sender balance
  SELECT troll_coins INTO v_sender_balance FROM public.user_profiles WHERE id = v_sender_id;
  IF v_sender_balance < v_gift_cost THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Calculate cuts
  v_admin_cut := FLOOR(v_gift_cost * 0.10);
  v_host_cut := v_gift_cost - v_admin_cut;

  -- Deduct from sender
  UPDATE public.user_profiles 
  SET troll_coins = troll_coins - v_gift_cost 
  WHERE id = v_sender_id;

  -- Add to recipient (Broadcaster/Guest)
  UPDATE public.user_profiles 
  SET troll_coins = troll_coins + v_host_cut 
  WHERE id = p_recipient_id;

  -- Record the gift
  INSERT INTO public.stream_gifts (stream_id, sender_id, recipient_id, gift_id)
  VALUES (p_stream_id, v_sender_id, p_recipient_id, p_gift_id);

  -- BATTLE SCORING LOGIC
  -- Check if this stream is in a battle
  SELECT battle_id INTO v_battle_id FROM public.streams WHERE id = p_stream_id;
  
  IF v_battle_id IS NOT NULL THEN
    -- Check if it's the challenger stream
    SELECT (challenger_stream_id = p_stream_id) INTO v_is_challenger 
    FROM public.battles WHERE id = v_battle_id AND status = 'active';
    
    -- If found in active battle, update score
    IF v_is_challenger IS NOT NULL THEN
        IF v_is_challenger THEN
            UPDATE public.battles SET score_challenger = score_challenger + v_gift_cost WHERE id = v_battle_id;
        ELSE
            UPDATE public.battles SET score_opponent = score_opponent + v_gift_cost WHERE id = v_battle_id;
        END IF;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
