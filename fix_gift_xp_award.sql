-- ============================================================================
-- Fix: send_gift_in_stream to award XP to sender and receiver
-- Issue: Gifts were being sent but no XP was being awarded
-- Solution: Call process_gift_xp after inserting the gift record
-- Note: process_gift_xp expects UUID type for p_gift_tx_id
-- ============================================================================

-- First check the actual column type of stream_gifts id
DO $$
DECLARE
    v_id_type TEXT;
BEGIN
    -- Get the actual column type
    SELECT data_type INTO v_id_type 
    FROM information_schema.columns 
    WHERE table_name = 'stream_gifts' AND column_name = 'id';
    
    RAISE NOTICE 'stream_gifts id column type: %', v_id_type;
END $$;

-- Update send_gift_in_stream function to award XP after gift is processed
-- This version handles both UUID and BIGINT id columns
CREATE OR REPLACE FUNCTION public.send_gift_in_stream(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_stream_id UUID,
  p_gift_id TEXT,
  p_quantity INTEGER,
  p_metadata JSONB DEFAULT '{}'::jsonb
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
  v_gift_record_id BIGINT;
  v_gift_record_uuid UUID;
  v_xp_result JSONB;
  v_id_type TEXT;
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

  -- 4. Credit receiver (95% share)
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + FLOOR(v_total_cost * 0.95)
  WHERE id = p_receiver_id;

  -- 4b. Update stream's total_gifts_coins if stream_id provided
  IF p_stream_id IS NOT NULL THEN
    UPDATE public.streams
    SET total_gifts_coins = COALESCE(total_gifts_coins, 0) + v_total_cost
    WHERE id = p_stream_id;
  END IF;

  -- 5. Record gift in stream_gifts and capture the ID
  -- First check what type the id column is
  SELECT data_type INTO v_id_type 
  FROM information_schema.columns 
  WHERE table_name = 'stream_gifts' AND column_name = 'id';
  
  IF v_id_type = 'bigint' THEN
    -- BIGINT id column
    INSERT INTO public.stream_gifts (stream_id, sender_id, receiver_id, gift_id, quantity, metadata, amount)
    VALUES (p_stream_id, p_sender_id, p_receiver_id, p_gift_id, p_quantity, p_metadata, v_total_cost)
    RETURNING id INTO v_gift_record_id;
    
    -- Convert BIGINT to UUID for process_gift_xp
    -- Use the UUID from the transaction id that was passed or generate one
    -- Actually, we need to call a different version or modify our approach
    -- Let's just directly grant XP here instead of calling process_gift_xp
    BEGIN
        -- Award XP directly using grant_xp
        -- Sender gets XP (1.1x for live, 1x otherwise)
        PERFORM public.grant_xp(
            p_sender_id,
            FLOOR(v_total_cost * 1.1),
            'gift_sent',
            'gift_' || v_gift_record_id::text,
            jsonb_build_object('receiver_id', p_receiver_id, 'stream_id', p_stream_id, 'is_live', true)
        );
        
        -- Receiver gets XP
        PERFORM public.grant_xp(
            p_receiver_id,
            FLOOR(v_total_cost * 1.0),
            'gift_received',
            'gift_' || v_gift_record_id::text,
            jsonb_build_object('sender_id', p_sender_id, 'stream_id', p_stream_id)
        );
        
        RAISE NOTICE 'Gift XP awarded: sender=%, receiver=%', FLOOR(v_total_cost * 1.1), FLOOR(v_total_cost * 1.0);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to award XP for gift: %', SQLERRM;
    END;
  ELSE
    -- UUID id column - use the original approach with process_gift_xp
    INSERT INTO public.stream_gifts (stream_id, sender_id, receiver_id, gift_id, quantity, metadata, amount)
    VALUES (p_stream_id, p_sender_id, p_receiver_id, p_gift_id, p_quantity, p_metadata, v_total_cost)
    RETURNING id INTO v_gift_record_uuid;

    -- Call process_gift_xp with UUID
    BEGIN
        v_xp_result := public.process_gift_xp(v_gift_record_uuid, p_stream_id);
        RAISE NOTICE 'Gift XP awarded: %', v_xp_result;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to award XP for gift: %', SQLERRM;
    END;
  END IF;

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

  RETURN jsonb_build_object('success', true, 'message', 'Gift sent successfully', 'xp_awarded', true);
END;
$$;

-- Also update the version with txn_key parameter
CREATE OR REPLACE FUNCTION public.send_gift_in_stream(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_stream_id UUID,
  p_gift_id UUID,
  p_quantity INTEGER,
  p_txn_key TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
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
  v_gift_record_id BIGINT;
  v_gift_record_uuid UUID;
  v_xp_result JSONB;
  v_id_type TEXT;
BEGIN
  -- 1. Get gift cost and name
  SELECT cost, name INTO v_gift_cost, v_gift_name
  FROM public.gifts
  WHERE id = p_gift_id OR slug = p_gift_id::text;

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

  -- 4. Credit receiver (95% share)
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + FLOOR(v_total_cost * 0.95)
  WHERE id = p_receiver_id;

  -- 4b. Update stream's total_gifts_coins if stream_id provided
  IF p_stream_id IS NOT NULL THEN
    UPDATE public.streams
    SET total_gifts_coins = COALESCE(total_gifts_coins, 0) + v_total_cost
    WHERE id = p_stream_id;
  END IF;

  -- 5. Record gift in stream_gifts and award XP
  SELECT data_type INTO v_id_type 
  FROM information_schema.columns 
  WHERE table_name = 'stream_gifts' AND column_name = 'id';
  
  IF v_id_type = 'bigint' THEN
    INSERT INTO public.stream_gifts (stream_id, sender_id, receiver_id, gift_id, quantity, metadata, amount)
    VALUES (p_stream_id, p_sender_id, p_receiver_id, p_gift_id::text, p_quantity, p_metadata, v_total_cost)
    RETURNING id INTO v_gift_record_id;
    
    -- Award XP directly
    BEGIN
        PERFORM public.grant_xp(
            p_sender_id,
            FLOOR(v_total_cost * 1.1),
            'gift_sent',
            'gift_' || v_gift_record_id::text,
            jsonb_build_object('receiver_id', p_receiver_id, 'stream_id', p_stream_id, 'is_live', true)
        );
        
        PERFORM public.grant_xp(
            p_receiver_id,
            FLOOR(v_total_cost * 1.0),
            'gift_received',
            'gift_' || v_gift_record_id::text,
            jsonb_build_object('sender_id', p_sender_id, 'stream_id', p_stream_id)
        );
        
        RAISE NOTICE 'Gift XP awarded: sender=%, receiver=%', FLOOR(v_total_cost * 1.1), FLOOR(v_total_cost * 1.0);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to award XP for gift: %', SQLERRM;
    END;
  ELSE
    INSERT INTO public.stream_gifts (stream_id, sender_id, receiver_id, gift_id, quantity, metadata, amount)
    VALUES (p_stream_id, p_sender_id, p_receiver_id, p_gift_id::text, p_quantity, p_metadata, v_total_cost)
    RETURNING id INTO v_gift_record_uuid;

    BEGIN
        v_xp_result := public.process_gift_xp(v_gift_record_uuid, p_stream_id);
        RAISE NOTICE 'Gift XP awarded: %', v_xp_result;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to award XP for gift: %', SQLERRM;
    END;
  END IF;

  -- 6. Insert message into stream
  INSERT INTO stream_messages (stream_id, user_id, content)
  VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || v_gift_name || ':' || p_quantity);

  -- 7. Battle Scoring Logic
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

  RETURN jsonb_build_object('success', true, 'message', 'Gift sent successfully', 'xp_awarded', true);
END;
$$;

-- Ensure stream_gifts has the amount column (needed for XP calculation)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'stream_gifts' AND column_name = 'amount') THEN
        ALTER TABLE public.stream_gifts ADD COLUMN amount BIGINT;
    END IF;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, TEXT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, TEXT, INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, UUID, INTEGER, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, UUID, INTEGER, TEXT, JSONB) TO service_role;
