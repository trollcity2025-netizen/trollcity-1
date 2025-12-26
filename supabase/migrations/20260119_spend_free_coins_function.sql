-- RPC for deducting Trollmonds directly from the wallets table
CREATE OR REPLACE FUNCTION spend_trollmonds(
  p_user_id uuid,
  p_amount bigint,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet record;
  v_remaining bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT *
  INTO v_wallet
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet row not found for user %', p_user_id;
  END IF;

  v_remaining := COALESCE(v_wallet.trollmonds, 0);
  IF v_remaining < p_amount THEN
    RAISE EXCEPTION 'Insufficient Trollmonds: required %, available %', p_amount, v_remaining;
  END IF;

  UPDATE wallets
  SET trollmonds = v_remaining - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  UPDATE user_profiles
  SET trollmonds = GREATEST(COALESCE(trollmonds, 0) - p_amount, 0),
      total_spent_coins = COALESCE(total_spent_coins, 0) + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  BEGIN
  INSERT INTO coin_transactions (
      user_id,
      type,
      amount,
      coin_type,
      description,
      metadata,
      coin_delta,
      created_at
    )
    VALUES (
      p_user_id,
      'wheel_spin',
      p_amount,
      'trollmonds',
      'Troll Wheel spin',
      jsonb_build_object('reason', p_reason),
      -p_amount,
      NOW()
    );
  EXCEPTION WHEN undefined_table THEN
    -- coin_transactions table might not exist in older deployments
    NULL;
  EXCEPTION WHEN others THEN
    -- Handle other exceptions (e.g., null constraint violations)
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'remaining', v_remaining - p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION spend_trollmonds(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION spend_trollmonds(uuid, bigint, text) TO service_role;
