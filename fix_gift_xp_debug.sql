-- ============================================================================
-- Debug and Fix: Check if grant_xp works and add simpler XP award
-- ============================================================================

-- First, let's check what the current send_gift_in_stream function looks like
-- This will help us debug

-- Let's also add a simpler test function to verify XP works
CREATE OR REPLACE FUNCTION public.test_grant_xp(p_user_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.grant_xp(
        p_user_id,
        p_amount,
        'test_gift',
        'test_' || NOW()::text,
        '{}'::jsonb,
        'test'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_grant_xp(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_grant_xp(UUID, NUMERIC) TO service_role;

-- Now let's fix send_gift_in_stream with a simpler approach
-- Just directly update user_profiles and user_stats without calling process_gift_xp

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
  v_sender_xp NUMERIC;
  v_receiver_xp NUMERIC;
  v_new_sender_xp NUMERIC;
  v_new_receiver_xp NUMERIC;
  v_level_info RECORD;
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

  -- 5. Calculate XP (1.1x for sender if live, 1x for receiver)
  v_sender_xp := FLOOR(v_total_cost * 1.1);
  v_receiver_xp := FLOOR(v_total_cost * 1.0);

  -- 6. Award XP to sender directly in user_profiles
  UPDATE public.user_profiles
  SET total_xp = COALESCE(total_xp, 0) + v_sender_xp
  WHERE id = p_sender_id
  RETURNING total_xp INTO v_new_sender_xp;

  -- 7. Award XP to receiver directly in user_profiles
  UPDATE public.user_profiles
  SET total_xp = COALESCE(total_xp, 0) + v_receiver_xp
  WHERE id = p_receiver_id
  RETURNING total_xp INTO v_new_receiver_xp;

  -- 8. Update user_stats for sender
  BEGIN
    SELECT lvl, xp_for_next_level, progress 
    INTO v_level_info
    FROM public.calculate_level_details(v_new_sender_xp::BIGINT);

    INSERT INTO public.user_stats (user_id, xp_total, level, xp_to_next_level, xp_progress, updated_at)
    VALUES (p_sender_id, v_new_sender_xp, v_level_info.lvl, v_level_info.xp_for_next_level, v_level_info.progress, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        xp_total = v_new_sender_xp,
        level = v_level_info.lvl,
        xp_to_next_level = v_level_info.xp_for_next_level,
        xp_progress = v_level_info.progress,
        updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to update sender user_stats: %', SQLERRM;
  END;

  -- 9. Update user_stats for receiver
  BEGIN
    SELECT lvl, xp_for_next_level, progress 
    INTO v_level_info
    FROM public.calculate_level_details(v_new_receiver_xp::BIGINT);

    INSERT INTO public.user_stats (user_id, xp_total, level, xp_to_next_level, xp_progress, updated_at)
    VALUES (p_receiver_id, v_new_receiver_xp, v_level_info.lvl, v_level_info.xp_for_next_level, v_level_info.progress, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        xp_total = v_new_receiver_xp,
        level = v_level_info.lvl,
        xp_to_next_level = v_level_info.xp_for_next_level,
        xp_progress = v_level_info.progress,
        updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to update receiver user_stats: %', SQLERRM;
  END;

  -- 10. Record gift in stream_gifts
  INSERT INTO public.stream_gifts (stream_id, sender_id, receiver_id, gift_id, quantity, metadata, amount)
  VALUES (p_stream_id, p_sender_id, p_receiver_id, p_gift_id, p_quantity, p_metadata, v_total_cost);

  -- 11. Insert message into stream
  INSERT INTO stream_messages (stream_id, user_id, content)
  VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || v_gift_name || ':' || p_quantity);

  -- 12. Battle Scoring Logic
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

  RAISE NOTICE 'Gift XP awarded: sender +%, receiver +%', v_sender_xp, v_receiver_xp;

  RETURN jsonb_build_object('success', true, 'message', 'Gift sent successfully', 'xp_awarded', true, 'sender_xp', v_sender_xp, 'receiver_xp', v_receiver_xp);
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
  v_sender_xp NUMERIC;
  v_receiver_xp NUMERIC;
  v_new_sender_xp NUMERIC;
  v_new_receiver_xp NUMERIC;
  v_level_info RECORD;
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

  -- 5. Calculate XP
  v_sender_xp := FLOOR(v_total_cost * 1.1);
  v_receiver_xp := FLOOR(v_total_cost * 1.0);

  -- 6. Award XP to sender in user_profiles
  UPDATE public.user_profiles
  SET total_xp = COALESCE(total_xp, 0) + v_sender_xp
  WHERE id = p_sender_id
  RETURNING total_xp INTO v_new_sender_xp;

  -- 7. Award XP to receiver in user_profiles
  UPDATE public.user_profiles
  SET total_xp = COALESCE(total_xp, 0) + v_receiver_xp
  WHERE id = p_receiver_id
  RETURNING total_xp INTO v_new_receiver_xp;

  -- 8. Update user_stats for sender
  BEGIN
    SELECT lvl, xp_for_next_level, progress 
    INTO v_level_info
    FROM public.calculate_level_details(v_new_sender_xp::BIGINT);

    INSERT INTO public.user_stats (user_id, xp_total, level, xp_to_next_level, xp_progress, updated_at)
    VALUES (p_sender_id, v_new_sender_xp, v_level_info.lvl, v_level_info.xp_for_next_level, v_level_info.progress, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        xp_total = v_new_sender_xp,
        level = v_level_info.lvl,
        xp_to_next_level = v_level_info.xp_for_next_level,
        xp_progress = v_level_info.progress,
        updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to update sender user_stats: %', SQLERRM;
  END;

  -- 9. Update user_stats for receiver
  BEGIN
    SELECT lvl, xp_for_next_level, progress 
    INTO v_level_info
    FROM public.calculate_level_details(v_new_receiver_xp::BIGINT);

    INSERT INTO public.user_stats (user_id, xp_total, level, xp_to_next_level, xp_progress, updated_at)
    VALUES (p_receiver_id, v_new_receiver_xp, v_level_info.lvl, v_level_info.xp_for_next_level, v_level_info.progress, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        xp_total = v_new_receiver_xp,
        level = v_level_info.lvl,
        xp_to_next_level = v_level_info.xp_for_next_level,
        xp_progress = v_level_info.progress,
        updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to update receiver user_stats: %', SQLERRM;
  END;

  -- 10. Record gift in stream_gifts
  INSERT INTO public.stream_gifts (stream_id, sender_id, receiver_id, gift_id, quantity, metadata, amount)
  VALUES (p_stream_id, p_sender_id, p_receiver_id, p_gift_id::text, p_quantity, p_metadata, v_total_cost);

  -- 11. Insert message into stream
  INSERT INTO stream_messages (stream_id, user_id, content)
  VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || v_gift_name || ':' || p_quantity);

  -- 12. Battle Scoring Logic
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

  RAISE NOTICE 'Gift XP awarded: sender +%, receiver +%', v_sender_xp, v_receiver_xp;

  RETURN jsonb_build_object('success', true, 'message', 'Gift sent successfully', 'xp_awarded', true, 'sender_xp', v_sender_xp, 'receiver_xp', v_receiver_xp);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, TEXT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, TEXT, INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, UUID, INTEGER, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(UUID, UUID, UUID, UUID, INTEGER, TEXT, JSONB) TO service_role;

-- Ensure stream_gifts has the amount column
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'stream_gifts' AND column_name = 'amount') THEN
        ALTER TABLE public.stream_gifts ADD COLUMN amount BIGINT;
    END IF;
END $$;
