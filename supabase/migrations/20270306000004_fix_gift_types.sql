-- Fix for "invalid input syntax for type integer" and potential overflows
-- 1. Update send_premium_gift to accept NUMERIC for cost (handles "100.00" strings) and use BIGINT internally.
-- 2. Update send_wall_post_gift to use BIGINT for coin calculations to support high balances.
-- 3. Ensure user_profiles.troll_coins is treated correctly (safe cast).

-- Fix send_premium_gift
CREATE OR REPLACE FUNCTION public.send_premium_gift(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_stream_id UUID,
  p_gift_id TEXT, 
  p_cost NUMERIC -- Changed from INTEGER to allow "100.00" formats
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_cost BIGINT;
  v_cashback INTEGER;
  v_bonus_cashback INTEGER := 0;
  v_total_cashback INTEGER;
  v_is_tier_iv_v BOOLEAN := FALSE;
  v_is_gold_trigger BOOLEAN := FALSE;
BEGIN
  -- Safe cast cost to bigint
  v_cost := FLOOR(p_cost)::BIGINT;

  -- 1. Check Balance
  -- Ensure we cast correctly if the column type is somehow wonky, though it should be bigint/numeric
  SELECT FLOOR(troll_coins::numeric)::BIGINT INTO v_sender_balance FROM user_profiles WHERE id = p_sender_id;
  
  IF v_sender_balance < v_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- 2. Determine Tier/Bonuses
  IF v_cost >= 10000 THEN
    v_is_tier_iv_v := TRUE;
    v_bonus_cashback := FLOOR(v_cost * 0.05); -- 5%
  END IF;

  IF v_cost = 1000000 THEN
    v_is_gold_trigger := TRUE;
  END IF;

  -- Random Cashback 1-50
  v_cashback := floor(random() * 50 + 1)::int;
  v_total_cashback := v_cashback + v_bonus_cashback;

  -- 3. Deduct Cost
  UPDATE user_profiles 
  SET troll_coins = troll_coins - v_cost + v_total_cashback
  WHERE id = p_sender_id;

  -- 4. Credit Receiver (95% share)
  UPDATE user_profiles
  SET troll_coins = troll_coins + FLOOR(v_cost * 0.95),
      total_coins_earned = COALESCE(total_coins_earned, 0) + FLOOR(v_cost * 0.95)
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
    (p_sender_id, -v_cost, 'gift_sent', jsonb_build_object('gift_id', p_gift_id, 'receiver_id', p_receiver_id, 'stream_id', p_stream_id, 'cashback', v_total_cashback)),
    (p_receiver_id, FLOOR(v_cost * 0.95), 'gift_received', jsonb_build_object('gift_id', p_gift_id, 'sender_id', p_sender_id, 'stream_id', p_stream_id));
    
  -- Also insert into stream_messages for visibility
  INSERT INTO stream_messages (stream_id, user_id, content, type)
  VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || p_gift_id || ':' || v_cost, 'system');

  RETURN jsonb_build_object(
    'success', true, 
    'cashback', v_total_cashback,
    'rgb_awarded', v_is_tier_iv_v,
    'gold_awarded', v_is_gold_trigger
  );
END;
$$;

-- Fix send_wall_post_gift (Overflow protection + type safety)
CREATE OR REPLACE FUNCTION public.send_wall_post_gift(
  p_post_id uuid,
  p_gift_type text,
  p_quantity integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_gift_cost bigint; -- Changed to bigint
  v_sender_coins bigint; -- Changed to bigint
  v_post_owner_id uuid;
  v_receiver_reward bigint; -- Changed to bigint
  v_tx_sender uuid;
  v_tx_receiver uuid;
  v_default_cost integer := 10;
  v_safe_quantity integer;
begin
  if v_sender_id is null then
    raise exception 'Not authenticated';
  end if;

  v_safe_quantity := greatest(1, p_quantity);

  select coin_cost into v_gift_cost from gifts where lower(name) = lower(p_gift_type) limit 1;
  if v_gift_cost is null then
    v_gift_cost := v_default_cost;
  end if;
  v_gift_cost := v_gift_cost * v_safe_quantity;

  -- Safe select with cast
  select FLOOR(troll_coins::numeric)::BIGINT into v_sender_coins from user_profiles where id = v_sender_id;
  
  if coalesce(v_sender_coins, 0) < v_gift_cost then
    return jsonb_build_object('success', false, 'error', 'Insufficient coins', 'required', v_gift_cost, 'available', coalesce(v_sender_coins,0));
  end if;

  select user_id into v_post_owner_id from troll_wall_posts where id = p_post_id;
  if v_post_owner_id is null then
    return jsonb_build_object('success', false, 'error', 'Post not found');
  end if;

  -- deduct sender balance
  update user_profiles set troll_coins = coalesce(troll_coins,0) - v_gift_cost where id = v_sender_id;

  -- credit receiver 80%
  v_receiver_reward := floor(v_gift_cost * 0.8);
  update user_profiles set troll_coins = coalesce(troll_coins,0) + v_receiver_reward where id = v_post_owner_id;

  insert into troll_wall_gifts (post_id, sender_id, gift_type, quantity, coin_cost)
  values (p_post_id, v_sender_id, p_gift_type, v_safe_quantity, v_gift_cost);

  -- coin transaction logs
  insert into coin_transactions (user_id, amount, type, description, metadata)
    values (v_sender_id, -v_gift_cost, 'gift_sent_wall', 'Gift sent on wall post', jsonb_build_object('post_id', p_post_id, 'gift_type', p_gift_type, 'quantity', v_safe_quantity, 'receiver_id', v_post_owner_id))
    returning id into v_tx_sender;
  insert into coin_transactions (user_id, amount, type, description, metadata)
    values (v_post_owner_id, v_receiver_reward, 'gift_received_wall', 'Gift received on wall post', jsonb_build_object('post_id', p_post_id, 'gift_type', p_gift_type, 'quantity', v_safe_quantity, 'sender_id', v_sender_id))
    returning id into v_tx_receiver;

  return jsonb_build_object(
    'success', true,
    'gift_type', p_gift_type,
    'quantity', v_safe_quantity,
    'total_cost', v_gift_cost,
    'sender_coins', coalesce(v_sender_coins,0) - v_gift_cost,
    'receiver_reward', v_receiver_reward,
    'tx_sender', v_tx_sender,
    'tx_receiver', v_tx_receiver
  );
end;
$$;
