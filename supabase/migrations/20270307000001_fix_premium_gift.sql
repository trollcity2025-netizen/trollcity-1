-- Fix send_premium_gift to handle NULL stream_id and update broadcaster_stats
-- This ensures gift sending works from profiles and updates leaderboards correctly.

CREATE OR REPLACE FUNCTION public.send_premium_gift(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_stream_id UUID,
  p_gift_id TEXT, 
  p_cost INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_cashback INTEGER;
  v_bonus_cashback INTEGER := 0;
  v_total_cashback INTEGER;
  v_is_tier_iv_v BOOLEAN := FALSE;
  v_is_gold_trigger BOOLEAN := FALSE;
BEGIN
  -- 1. Check Balance
  SELECT troll_coins INTO v_sender_balance FROM user_profiles WHERE id = p_sender_id;
  IF v_sender_balance < p_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- 2. Determine Tier/Bonuses
  IF p_cost >= 10000 THEN
    v_is_tier_iv_v := TRUE;
    v_bonus_cashback := FLOOR(p_cost * 0.05); -- 5%
  END IF;

  IF p_cost = 1000000 THEN
    v_is_gold_trigger := TRUE;
  END IF;

  -- Random Cashback 1-50
  v_cashback := floor(random() * 50 + 1)::int;
  v_total_cashback := v_cashback + v_bonus_cashback;

  -- 3. Deduct Cost (Sender)
  UPDATE user_profiles 
  SET troll_coins = troll_coins - p_cost + v_total_cashback
  WHERE id = p_sender_id;

  -- 4. Credit Receiver (95% share)
  UPDATE user_profiles
  SET troll_coins = troll_coins + FLOOR(p_cost * 0.95),
      total_coins_earned = COALESCE(total_coins_earned, 0) + FLOOR(p_cost * 0.95)
  WHERE id = p_receiver_id;

  -- 5. Apply Status
  IF v_is_tier_iv_v THEN
    -- RGB for 30 days
    UPDATE user_profiles
    SET rgb_username_expires_at = GREATEST(now(), COALESCE(rgb_username_expires_at, now())) + INTERVAL '30 days'
    WHERE id = p_sender_id;
  END IF;

  IF v_is_gold_trigger THEN
    -- GOLD PERMANENT
    UPDATE user_profiles
    SET is_gold = TRUE, gold_granted_at = now()
    WHERE id = p_sender_id;
  END IF;

  -- 6. Record Transaction
  INSERT INTO coin_transactions (user_id, amount, type, metadata)
  VALUES 
    (p_sender_id, -p_cost, 'gift_sent', jsonb_build_object('gift_id', p_gift_id, 'receiver_id', p_receiver_id, 'stream_id', p_stream_id, 'cashback', v_total_cashback)),
    (p_receiver_id, FLOOR(p_cost * 0.95), 'gift_received', jsonb_build_object('gift_id', p_gift_id, 'sender_id', p_sender_id, 'stream_id', p_stream_id));
    
  -- 7. Insert into stream_messages (ONLY IF STREAM EXISTS)
  IF p_stream_id IS NOT NULL THEN
    INSERT INTO stream_messages (stream_id, user_id, content, type)
    VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || p_gift_id || ':' || p_cost, 'system');
  END IF;

  -- 8. Update Broadcaster Stats (for Leaderboard)
  -- Ensure table exists or handle gracefully
  BEGIN
    INSERT INTO public.broadcaster_stats (user_id, total_gifts_24h, total_gifts_all_time, last_updated_at)
    VALUES (p_receiver_id, p_cost, p_cost, now())
    ON CONFLICT (user_id) DO UPDATE SET
        total_gifts_24h = broadcaster_stats.total_gifts_24h + EXCLUDED.total_gifts_24h,
        total_gifts_all_time = broadcaster_stats.total_gifts_all_time + EXCLUDED.total_gifts_all_time,
        last_updated_at = now();
  EXCEPTION WHEN undefined_table THEN
    -- Ignore if table doesn't exist (though it should)
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true, 
    'cashback', v_total_cashback,
    'rgb_awarded', v_is_tier_iv_v,
    'gold_awarded', v_is_gold_trigger
  );
END;
$$;
