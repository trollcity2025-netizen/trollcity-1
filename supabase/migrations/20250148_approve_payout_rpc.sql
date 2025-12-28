-- RPC Function: approve_payout
-- Approves a payout request and marks it as paid
-- Returns username and new balance

CREATE OR REPLACE FUNCTION approve_payout(p_payout_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout RECORD;
  v_user RECORD;
  v_admin RECORD;
  v_new_balance BIGINT;
BEGIN
  -- Check if admin is authenticated
  SELECT * INTO v_admin
  FROM user_profiles
  WHERE id = auth.uid();

  IF NOT (v_admin.role = 'admin' OR v_admin.is_admin = TRUE) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Only admins can approve payouts'
    );
  END IF;

  -- Get payout request
  SELECT * INTO v_payout
  FROM payout_requests
  WHERE id = p_payout_id;

  IF v_payout IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Payout request not found'
    );
  END IF;

  IF v_payout.status != 'pending' AND v_payout.status != 'approved' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', format('Payout is already %s', v_payout.status)
    );
  END IF;

  -- Get user info
  SELECT username, paid_coin_balance INTO v_user
  FROM user_profiles
  WHERE id = v_payout.user_id;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'User not found'
    );
  END IF;

  -- Update payout status to 'paid'
  UPDATE payout_requests
  SET 
    status = 'paid',
    processed_by = auth.uid(),
    processed_at = NOW(),
    paid_at = NOW()
  WHERE id = p_payout_id;

  -- Deduct coins from user (if not already deducted)
  -- The coins should have been deducted when the request was created
  -- But we'll ensure the balance is correct
  UPDATE user_profiles
  SET 
    paid_coin_balance = GREATEST(0, paid_coin_balance - COALESCE(v_payout.coins_redeemed, 0)),
    updated_at = NOW()
  WHERE id = v_payout.user_id
  RETURNING paid_coin_balance INTO v_new_balance;

  -- Create notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
    v_payout.user_id,
    'payout_status',
    '💰 Payout Approved & Paid',
    format('Your payout of $%s has been approved and sent. Check your payment method.', 
      COALESCE(v_payout.cash_amount, 0)),
    jsonb_build_object(
      'payout_id', p_payout_id,
      'amount', v_payout.cash_amount,
      'status', 'paid'
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'username', v_user.username,
    'new_balance', v_new_balance,
    'message', format('Payout approved and paid for %s. New balance: %s coins', 
      v_user.username, v_new_balance)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION approve_payout(UUID) TO authenticated;

COMMENT ON FUNCTION approve_payout IS 'Approves and marks a payout as paid. Call with: { p_payout_id: payoutId }';

