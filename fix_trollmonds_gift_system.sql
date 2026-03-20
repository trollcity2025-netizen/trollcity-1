-- ============================================================================
-- FIX: Trollmonds Gift Discount System
-- ============================================================================
-- This migration updates send_gift_in_stream to handle:
-- 1. Trollmonds discount: 10% off per 100 trollmonds (sender gets discount)
-- 2. Receiver gets FULL gift value (no discount for them)
-- 3. Sender loses 100 trollmonds per gift sent (regardless of gift size)
-- 4. Real-time balance updates via postgres_changes events
-- ============================================================================

-- First, ensure trollmonds_balance column exists in user_profiles
ALTER TABLE user_profiles 
    ADD COLUMN IF NOT EXISTS trollmonds_balance INTEGER DEFAULT 0;

-- Update send_gift_in_stream to handle trollmonds discount system
DROP FUNCTION IF EXISTS public.send_gift_in_stream(UUID, UUID, UUID, TEXT, INTEGER, JSONB);

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
  v_sender_troll_coins BIGINT;
  v_sender_trollmonds BIGINT;
  v_gift_cost BIGINT;
  v_total_cost BIGINT;
  v_discount_percent DECIMAL;
  v_discounted_cost BIGINT;
  v_gift_name TEXT;
  v_battle_id UUID;
  v_is_challenger BOOLEAN;
  v_trollmonds_deduction INTEGER := 0;
BEGIN
  -- 1. Get gift cost and name
  SELECT cost, name INTO v_gift_cost, v_gift_name
  FROM public.gifts
  WHERE id::text = p_gift_id OR slug = p_gift_id;

  IF v_gift_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift not found');
  END IF;

  v_total_cost := v_gift_cost * p_quantity;

  -- 2. Get sender's troll_coins AND trollmonds_balance
  SELECT troll_coins, COALESCE(trollmonds_balance, 0) INTO v_sender_troll_coins, v_sender_trollmonds
  FROM public.user_profiles 
  WHERE id = p_sender_id;

  -- 3. Calculate trollmonds discount: 10% per 100 trollmonds
  -- For every 100 trollmonds, sender gets 10% off
  v_discount_percent := (v_sender_trollmonds / 100) * 10;
  
  -- Cap discount at 100% (max 1000 trollmonds = 100% discount)
  IF v_discount_percent > 100 THEN
    v_discount_percent := 100;
  END IF;

  -- Calculate discounted cost for sender
  v_discounted_cost := FLOOR(v_total_cost * (1 - v_discount_percent / 100));

  -- 4. Check sender has enough troll_coins for the discounted price
  IF v_sender_troll_coins < v_discounted_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- 5. Deduct discounted cost from sender's troll_coins
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_discounted_cost,
      updated_at = NOW()
  WHERE id = p_sender_id;

  -- 6. Deduct 100 trollmonds from sender per gift sent (regardless of gift size)
  -- Only deduct if sender has trollmonds
  IF v_sender_trollmonds >= 100 THEN
    v_trollmonds_deduction := 100;
    UPDATE public.user_profiles
    SET trollmonds_balance = trollmonds_balance - v_trollmonds_deduction,
        updated_at = NOW()
    WHERE id = p_sender_id;
  END IF;

  -- 7. Credit receiver FULL value (they get the full gift, no discount)
  -- This is 95% of original cost (not discounted cost) to maintain proper economics
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + FLOOR(v_total_cost * 0.95),
      updated_at = NOW()
  WHERE id = p_receiver_id;

  -- 8. Update stream's total_gifts_coins if stream_id provided
  IF p_stream_id IS NOT NULL THEN
    UPDATE public.streams
    SET total_gifts_coins = COALESCE(total_gifts_coins, 0) + v_total_cost
    WHERE id = p_stream_id;
  END IF;

  -- 9. Record gift in stream_gifts
  INSERT INTO public.stream_gifts (stream_id, sender_id, receiver_id, gift_id, quantity, metadata)
  VALUES (p_stream_id, p_sender_id, p_receiver_id, p_gift_id, p_quantity, p_metadata);

  -- 10. Insert message into stream
  INSERT INTO stream_messages (stream_id, user_id, content)
  VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || v_gift_name || ':' || p_quantity);

  -- 11. Battle Scoring Logic
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

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Gift sent successfully',
    'discount_percent', v_discount_percent,
    'original_cost', v_total_cost,
    'discounted_cost', v_discounted_cost,
    'trollmonds_deducted', v_trollmonds_deduction
  );
END;
$$;

-- Also update the version with more parameters (txn_key)
DROP FUNCTION IF EXISTS public.send_gift_in_stream(UUID, UUID, UUID, UUID, INTEGER, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.send_gift_in_stream(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_stream_id UUID,
  p_gift_id UUID,
  p_quantity INTEGER,
  p_txn_key TEXT,
  p_metadata JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_troll_coins BIGINT;
  v_sender_trollmonds BIGINT;
  v_gift_cost BIGINT;
  v_total_cost BIGINT;
  v_discount_percent DECIMAL;
  v_discounted_cost BIGINT;
  v_gift_name TEXT;
  v_battle_id UUID;
  v_is_challenger BOOLEAN;
  v_trollmonds_deduction INTEGER := 0;
BEGIN
  -- 1. Get gift cost and name
  SELECT cost, name INTO v_gift_cost, v_gift_name
  FROM public.gifts
  WHERE id::text = p_gift_id::text OR id = p_gift_id OR slug = p_gift_id::text;

  IF v_gift_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift not found');
  END IF;

  v_total_cost := v_gift_cost * p_quantity;

  -- 2. Get sender's troll_coins AND trollmonds_balance
  SELECT troll_coins, COALESCE(trollmonds_balance, 0) INTO v_sender_troll_coins, v_sender_trollmonds
  FROM public.user_profiles 
  WHERE id = p_sender_id;

  -- 3. Calculate trollmonds discount: 10% per 100 trollmonds
  -- For every 100 trollmonds, sender gets 10% off
  v_discount_percent := (v_sender_trollmonds / 100) * 10;
  
  -- Cap discount at 100% (max 1000 trollmonds = 100% discount)
  IF v_discount_percent > 100 THEN
    v_discount_percent := 100;
  END IF;

  -- Calculate discounted cost for sender
  v_discounted_cost := FLOOR(v_total_cost * (1 - v_discount_percent / 100));

  -- 4. Check sender has enough troll_coins for the discounted price
  IF v_sender_troll_coins < v_discounted_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- 5. Deduct discounted cost from sender's troll_coins
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_discounted_cost,
      updated_at = NOW()
  WHERE id = p_sender_id;

  -- 6. Deduct 100 trollmonds from sender per gift sent (regardless of gift size)
  -- Only deduct if sender has trollmonds
  IF v_sender_trollmonds >= 100 THEN
    v_trollmonds_deduction := 100;
    UPDATE public.user_profiles
    SET trollmonds_balance = trollmonds_balance - v_trollmonds_deduction,
        updated_at = NOW()
    WHERE id = p_sender_id;
  END IF;

  -- 7. Credit receiver FULL value (they get the full gift, no discount)
  -- This is 95% of original cost (not discounted cost) to maintain proper economics
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + FLOOR(v_total_cost * 0.95),
      updated_at = NOW()
  WHERE id = p_receiver_id;

  -- 8. Update stream's total_gifts_coins if stream_id provided
  IF p_stream_id IS NOT NULL THEN
    UPDATE public.streams
    SET total_gifts_coins = COALESCE(total_gifts_coins, 0) + v_total_cost
    WHERE id = p_stream_id;
  END IF;

  -- 9. Record gift in stream_gifts
  INSERT INTO public.stream_gifts (stream_id, sender_id, receiver_id, gift_id, quantity, metadata)
  VALUES (p_stream_id, p_sender_id, p_receiver_id, p_gift_id::text, p_quantity, p_metadata);

  -- 10. Insert message into stream
  INSERT INTO stream_messages (stream_id, user_id, content)
  VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || v_gift_name || ':' || p_quantity);

  -- 11. Battle Scoring Logic
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

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Gift sent successfully',
    'discount_percent', v_discount_percent,
    'original_cost', v_total_cost,
    'discounted_cost', v_discounted_cost,
    'trollmonds_deducted', v_trollmonds_deduction
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, TEXT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, TEXT, INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, UUID, INTEGER, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, UUID, INTEGER, TEXT, JSONB) TO service_role;

SELECT '✅ Migration applied: Trollmonds gift discount system with real-time balance updates';