-- Fix: Receiver should get 100% of gift instead of 95%
-- This overrides the send_gift_in_stream function

CREATE OR REPLACE FUNCTION public.send_gift_in_stream(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_stream_id UUID,
  p_gift_id TEXT,
  p_quantity INTEGER,
  p_metadata JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_gift_cost BIGINT;
  v_total_cost BIGINT;
  v_gift_name TEXT;
  v_battle_id UUID;
  v_is_challenger BOOLEAN;
BEGIN
  -- 1. Get gift cost and name
  SELECT cost, name INTO v_gift_cost, v_gift_name
  FROM public.gifts
  WHERE id::text = p_gift_id OR slug = p_gift_id;

  IF v_gift_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift not found');
  END IF;

  v_total_cost := v_gift_cost * p_quantity;

  -- 2. Check sender's balance
  SELECT troll_coins INTO v_sender_balance FROM public.user_profiles WHERE id = p_sender_id;
  IF v_sender_balance < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- 3. Deduct cost from sender
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_total_cost
  WHERE id = p_sender_id;

  -- 4. Credit receiver 100% (changed from 95%)
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + v_total_cost
  WHERE id = p_receiver_id;

  -- 4b. Update stream's total_gifts_coins if stream_id provided
  IF p_stream_id IS NOT NULL THEN
    UPDATE public.streams
    SET total_gifts_coins = COALESCE(total_gifts_coins, 0) + v_total_cost
    WHERE id = p_stream_id;
  END IF;

  -- 5. Record gift in stream_gifts
  INSERT INTO public.stream_gifts (stream_id, sender_id, receiver_id, gift_id, quantity, metadata)
  VALUES (p_stream_id, p_sender_id, p_receiver_id, p_gift_id, p_quantity, p_metadata);

  -- 6. Insert message into stream
  INSERT INTO stream_messages (stream_id, user_id, content)
  VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || v_gift_name || ':' || p_quantity);

  -- 7. Battle Scoring Logic
  -- Check if this stream is part of an active battle
  SELECT id, (challenger_stream_id = p_stream_id) INTO v_battle_id, v_is_challenger
  FROM public.battles
  WHERE (challenger_stream_id = p_stream_id OR opponent_stream_id = p_stream_id)
    AND status = 'active'
  LIMIT 1;

  IF v_battle_id IS NOT NULL THEN
    IF v_is_challenger THEN
      UPDATE public.battles
      SET score_challenger = COALESCE(score_challenger, 0) + v_total_cost,
          pot_challenger = COALESCE(pot_challenger, 0) + v_total_cost
      WHERE id = v_battle_id;
    ELSE
      UPDATE public.battles
      SET score_opponent = COALESCE(score_opponent, 0) + v_total_cost,
          pot_opponent = COALESCE(pot_opponent, 0) + v_total_cost
      WHERE id = v_battle_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Gift sent successfully');
END;
$$;
