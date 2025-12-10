-- Add deduct_coins function for TrollTract contract purchases
-- This function deducts coins from user balance with proper validation

CREATE OR REPLACE FUNCTION deduct_coins(
  p_user_id uuid,
  p_amount bigint,
  p_coin_type text DEFAULT 'paid'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance bigint;
BEGIN
  -- Get current balance based on coin type
  IF p_coin_type = 'paid' THEN
    SELECT paid_coin_balance INTO v_current_balance
    FROM user_profiles
    WHERE id = p_user_id;
  ELSE
    SELECT free_coin_balance INTO v_current_balance
    FROM user_profiles
    WHERE id = p_user_id;
  END IF;

  -- Check if user exists
  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if sufficient balance
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient % coins. Required: %, Available: %', p_coin_type, p_amount, v_current_balance;
  END IF;

  -- Deduct coins
  IF p_coin_type = 'paid' THEN
    UPDATE user_profiles
    SET paid_coin_balance = paid_coin_balance - p_amount,
        total_spent_coins = COALESCE(total_spent_coins, 0) + p_amount,
        updated_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE user_profiles
    SET free_coin_balance = free_coin_balance - p_amount,
        total_spent_coins = COALESCE(total_spent_coins, 0) + p_amount,
        updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION deduct_coins(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_coins(uuid, bigint, text) TO service_role;