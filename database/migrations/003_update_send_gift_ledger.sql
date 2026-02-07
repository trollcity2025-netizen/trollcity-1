-- Update send_premium_gift to log to purchase_ledger
-- This ensures that every gift sent is recorded as a transaction in the central ledger
-- fulfilling the "Revenue & Inventory Sync" requirement.

CREATE OR REPLACE FUNCTION public.send_premium_gift(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_stream_id UUID,
  p_gift_id TEXT, 
  p_cost NUMERIC -- Support numeric to match signature, but cast to int for logic
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_item_id UUID;
  v_db_price INTEGER;
  v_item_name TEXT;
  v_actual_cost BIGINT;
  v_cashback INTEGER;
  v_bonus_cashback INTEGER := 0;
  v_total_cashback INTEGER;
  v_is_tier_iv_v BOOLEAN := FALSE;
  v_is_gold_trigger BOOLEAN := FALSE;
  v_ledger_id UUID;
BEGIN
  -- 1. Resolve Item in purchasable_items
  -- Try to parse p_gift_id as UUID first (new frontend sends UUID)
  BEGIN
    v_item_id := p_gift_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_item_id := NULL;
  END;

  IF v_item_id IS NOT NULL THEN
    SELECT id, coin_price, display_name INTO v_item_id, v_db_price, v_item_name
    FROM purchasable_items WHERE id = v_item_id;
  END IF;

  -- If not found by ID (or p_gift_id wasn't UUID), try by item_key (legacy frontend might send slug)
  IF v_item_id IS NULL THEN
    SELECT id, coin_price, display_name INTO v_item_id, v_db_price, v_item_name
    FROM purchasable_items WHERE item_key = p_gift_id;
  END IF;

  -- If still null, we cannot proceed because we need a purchase_ledger entry linked to an item
  IF v_item_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift item not found in inventory');
  END IF;

  -- Use DB price if available, otherwise fallback to p_cost (but DB price is authoritative)
  -- If DB price is null (e.g. dynamic price item?), use p_cost. But gifts usually have fixed prices.
  v_actual_cost := COALESCE(v_db_price, p_cost);
  
  -- Cast to BigInt for calculations
  v_actual_cost := FLOOR(v_actual_cost)::BIGINT;

  -- 2. Check Balance
  SELECT FLOOR(troll_coins::numeric)::BIGINT INTO v_sender_balance 
  FROM user_profiles WHERE id = p_sender_id;
  
  IF v_sender_balance < v_actual_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- 3. Determine Tier/Bonuses
  IF v_actual_cost >= 10000 THEN
    v_is_tier_iv_v := TRUE;
    v_bonus_cashback := FLOOR(v_actual_cost * 0.05); -- 5%
  END IF;

  IF v_actual_cost = 1000000 THEN
    v_is_gold_trigger := TRUE;
  END IF;

  -- Random Cashback 1-50
  v_cashback := floor(random() * 50 + 1)::int;
  v_total_cashback := v_cashback + v_bonus_cashback;

  -- 4. Deduct Cost (Sender)
  UPDATE user_profiles 
  SET troll_coins = troll_coins - v_actual_cost + v_total_cashback
  WHERE id = p_sender_id;

  -- 5. Credit Receiver (95% share)
  UPDATE user_profiles
  SET troll_coins = troll_coins + FLOOR(v_actual_cost * 0.95),
      total_coins_earned = COALESCE(total_coins_earned, 0) + FLOOR(v_actual_cost * 0.95)
  WHERE id = p_receiver_id;

  -- 6. Apply Status
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

  -- 7. Record to Purchase Ledger (The Single Source of Truth for Revenue)
  INSERT INTO public.purchase_ledger (
    user_id,
    item_id,
    coin_amount,
    payment_method,
    source_context,
    created_at
  ) VALUES (
    p_sender_id,
    v_item_id,
    v_actual_cost,
    'coins',
    'send_premium_gift',
    now()
  ) RETURNING id INTO v_ledger_id;

  -- 8. Record Legacy Transaction (for user history/UI compatibility)
  INSERT INTO coin_transactions (user_id, amount, type, metadata)
  VALUES 
    (p_sender_id, -v_actual_cost, 'gift_sent', jsonb_build_object('gift_id', p_gift_id, 'receiver_id', p_receiver_id, 'stream_id', p_stream_id, 'cashback', v_total_cashback, 'ledger_id', v_ledger_id)),
    (p_receiver_id, FLOOR(v_actual_cost * 0.95), 'gift_received', jsonb_build_object('gift_id', p_gift_id, 'sender_id', p_sender_id, 'stream_id', p_stream_id, 'ledger_id', v_ledger_id));
    
  -- 9. Stream Message
  IF p_stream_id IS NOT NULL THEN
    INSERT INTO stream_messages (stream_id, user_id, content, type)
    VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || p_gift_id || ':' || v_actual_cost, 'system');
  END IF;

  -- 10. Update Broadcaster Stats
  BEGIN
    INSERT INTO public.broadcaster_stats (user_id, total_gifts_24h, total_gifts_all_time, last_updated_at)
    VALUES (p_receiver_id, v_actual_cost, v_actual_cost, now())
    ON CONFLICT (user_id) DO UPDATE SET
        total_gifts_24h = broadcaster_stats.total_gifts_24h + EXCLUDED.total_gifts_24h,
        total_gifts_all_time = broadcaster_stats.total_gifts_all_time + EXCLUDED.total_gifts_all_time,
        last_updated_at = now();
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true, 
    'cashback', v_total_cashback,
    'rgb_awarded', v_is_tier_iv_v,
    'gold_awarded', v_is_gold_trigger,
    'ledger_id', v_ledger_id
  );
END;
$$;
