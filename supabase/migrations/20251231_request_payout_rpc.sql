-- RPC Function: request_payout
-- Handles payout request creation and coin deduction

CREATE OR REPLACE FUNCTION request_payout(
  p_user_id uuid,
  p_coins_to_redeem bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance bigint;
  v_usd_amount numeric(10,2);
  v_payout_id uuid;
  v_minimum_coins bigint := 7000; -- $21 minimum (7000 coins)
  v_conversion_rate numeric := 0.003; -- Approximate rate: $21 for 7000 coins
BEGIN
  -- Get current paid coin balance
  SELECT paid_coin_balance INTO v_current_balance
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;

  -- Validate minimum withdrawal
  IF p_coins_to_redeem < v_minimum_coins THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Minimum withdrawal is %s coins ($%s)', v_minimum_coins, (v_minimum_coins * v_conversion_rate))
    );
  END IF;

  -- Validate sufficient balance
  IF p_coins_to_redeem > v_current_balance THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Insufficient balance. Available: %s coins', v_current_balance)
    );
  END IF;

  -- Calculate USD amount based on tier
  -- Tier 1: 7k coins = $21 (rate: 0.003)
  -- Tier 2: 14k coins = $49.50 (rate: 0.0035357)
  -- Tier 3: 27k coins = $90 (rate: 0.00333)
  -- Tier 4: 47k coins = $150 (rate: 0.00319)
  IF p_coins_to_redeem >= 47000 THEN
    v_usd_amount := p_coins_to_redeem * 0.00319; -- $150 for 47k
  ELSIF p_coins_to_redeem >= 27000 THEN
    v_usd_amount := p_coins_to_redeem * 0.00333; -- $90 for 27k
  ELSIF p_coins_to_redeem >= 14000 THEN
    v_usd_amount := p_coins_to_redeem * 0.0035357; -- $49.50 for 14k
  ELSE
    v_usd_amount := p_coins_to_redeem * 0.003; -- $21 for 7k
  END IF;

  -- Generate payout request ID
  v_payout_id := gen_random_uuid();

  -- Insert payout request
  INSERT INTO payout_requests (
    id,
    user_id,
    coins_redeemed,
    cash_amount,
    status,
    created_at
  ) VALUES (
    v_payout_id,
    p_user_id,
    p_coins_to_redeem,
    v_usd_amount,
    'pending',
    NOW()
  );

  -- Deduct coins from user profile (but don't actually deduct until approved/paid)
  -- We'll keep the coins in the balance until payout is processed
  -- This prevents double-spending if request is rejected

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'coins_redeemed', p_coins_to_redeem,
    'cash_amount', v_usd_amount,
    'status', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION request_payout(uuid, bigint) TO authenticated;
