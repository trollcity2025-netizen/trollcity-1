-- Payout Request Functions

-- Function for users to request a payout
CREATE OR REPLACE FUNCTION request_payout(
  p_user_id UUID,
  p_amount_paid_coins INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_profile RECORD;
  v_cash_amount NUMERIC(10,2);
  v_processing_fee NUMERIC(10,2);
  v_net_amount NUMERIC(10,2);
  v_payout_id UUID;
  v_minimum INTEGER := 100;
  v_conversion_rate NUMERIC(10,4) := 0.10; -- $0.10 per paid coin
BEGIN
  -- Get user profile
  SELECT * INTO v_user_profile
  FROM user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Check if user is an approved broadcaster
  IF NOT v_user_profile.is_broadcaster THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only approved broadcasters can request payouts');
  END IF;

  -- Tax compliance check
  IF v_user_profile.tax_status = 'required' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tax form required. Please submit your W-9 form first.');
  END IF;

  IF v_user_profile.tax_status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout locked. Tax verification required.');
  END IF;

  -- Validate amount
  IF p_amount_paid_coins < v_minimum THEN
    RETURN jsonb_build_object('success', false, 'error', format('Minimum withdrawal is %s paid coins', v_minimum));
  END IF;

  IF p_amount_paid_coins > v_user_profile.paid_coin_balance THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient paid coin balance');
  END IF;

  -- Calculate amounts
  v_cash_amount := p_amount_paid_coins * v_conversion_rate;
  v_processing_fee := v_cash_amount * 0.05; -- 5% processing fee
  v_net_amount := v_cash_amount - v_processing_fee;

  -- Create payout request
  INSERT INTO payout_requests (
    user_id,
    coins_used,
    cash_amount,
    processing_fee,
    net_amount,
    status,
    created_at
  )
  VALUES (
    p_user_id,
    p_amount_paid_coins,
    v_cash_amount,
    v_processing_fee,
    v_net_amount,
    'pending',
    NOW()
  )
  RETURNING id INTO v_payout_id;

  -- Deduct coins from user balance (hold them until payout is processed)
  UPDATE user_profiles
  SET 
    paid_coin_balance = paid_coin_balance - p_amount_paid_coins,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO coin_transactions (
    user_id,
    type,
    amount,
    description,
    metadata
  )
  VALUES (
    p_user_id,
    'payout_request',
    -p_amount_paid_coins,
    format('Payout request: %s coins ($%s)', p_amount_paid_coins, v_net_amount),
    jsonb_build_object('payout_request_id', v_payout_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'message', 'Payout request submitted successfully'
  );
END;
$$;

-- Function for admin to update payout status
CREATE OR REPLACE FUNCTION admin_update_payout_status(
  p_payout_id UUID,
  p_admin_id UUID,
  p_new_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payout RECORD;
  v_user_profile RECORD;
BEGIN
  -- Verify admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin access required');
  END IF;

  -- Get payout request
  SELECT * INTO v_payout
  FROM payout_requests
  WHERE id = p_payout_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout request not found');
  END IF;

  -- Validate status transition
  IF v_payout.status = 'paid' AND p_new_status != 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot change status of paid payout');
  END IF;

  IF v_payout.status = 'rejected' AND p_new_status NOT IN ('rejected', 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot change status of rejected payout');
  END IF;

  -- Update payout status
  UPDATE payout_requests
  SET 
    status = p_new_status,
    updated_at = NOW(),
    notes = COALESCE(p_notes, notes),
    payment_reference = COALESCE(p_payment_reference, payment_reference)
  WHERE id = p_payout_id;

  -- Set timestamps based on status
  IF p_new_status = 'approved' THEN
    UPDATE payout_requests
    SET approved_at = NOW()
    WHERE id = p_payout_id;
  ELSIF p_new_status = 'paid' THEN
    UPDATE payout_requests
    SET paid_at = NOW()
    WHERE id = p_payout_id;
  ELSIF p_new_status = 'rejected' THEN
    -- If rejected, refund coins to user
    UPDATE user_profiles
    SET 
      paid_coin_balance = paid_coin_balance + v_payout.coins_used,
      updated_at = NOW()
    WHERE id = v_payout.user_id;

    -- Record refund transaction
    INSERT INTO coin_transactions (
      user_id,
      type,
      amount,
      description,
      metadata
    )
    VALUES (
      v_payout.user_id,
      'payout_refund',
      v_payout.coins_used,
      format('Payout request rejected: %s coins refunded', v_payout.coins_used),
      jsonb_build_object('payout_request_id', p_payout_id, 'rejection_reason', p_rejection_reason)
    );

    -- Update notes with rejection reason
    UPDATE payout_requests
    SET notes = COALESCE(p_rejection_reason, notes)
    WHERE id = p_payout_id;
  END IF;

  -- Send notification to user
  INSERT INTO notifications (
    user_id,
    message,
    type,
    read
  )
  VALUES (
    v_payout.user_id,
    CASE 
      WHEN p_new_status = 'approved' THEN format('💰 Your payout request of $%s has been approved and is being processed.', v_payout.net_amount)
      WHEN p_new_status = 'paid' THEN format('✅ Your payout of $%s has been sent!', v_payout.net_amount)
      WHEN p_new_status = 'rejected' THEN format('❌ Your payout request was rejected. Reason: %s', COALESCE(p_rejection_reason, 'Not specified'))
      ELSE format('📋 Your payout request status has been updated to: %s', p_new_status)
    END,
    CASE 
      WHEN p_new_status = 'paid' THEN 'success'
      WHEN p_new_status = 'rejected' THEN 'warning'
      ELSE 'info'
    END,
    false
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Payout status updated to %s', p_new_status)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION request_payout(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_payout_status(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Add missing columns to payout_requests if they don't exist
DO $$ 
BEGIN
  -- Add payment_method if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE payout_requests ADD COLUMN payment_method TEXT;
  END IF;

  -- Add payment_reference if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'payment_reference'
  ) THEN
    ALTER TABLE payout_requests ADD COLUMN payment_reference TEXT;
  END IF;

  -- Add notes if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'notes'
  ) THEN
    ALTER TABLE payout_requests ADD COLUMN notes TEXT;
  END IF;

  -- Add approved_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE payout_requests ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  -- Add paid_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE payout_requests ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;

  -- Add processed_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'processed_by'
  ) THEN
    ALTER TABLE payout_requests ADD COLUMN processed_by UUID REFERENCES user_profiles(id);
  END IF;

  -- Add rejection_reason if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE payout_requests ADD COLUMN rejection_reason TEXT;
  END IF;

  -- Ensure coins_used exists (some schemas use coin_amount)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'coins_used'
  ) THEN
    ALTER TABLE payout_requests ADD COLUMN coins_used INTEGER;
    -- Migrate from coin_amount if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'payout_requests' AND column_name = 'coin_amount'
    ) THEN
      UPDATE payout_requests SET coins_used = coin_amount WHERE coins_used IS NULL;
    END IF;
  END IF;

  -- Ensure net_amount exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'net_amount'
  ) THEN
    ALTER TABLE payout_requests ADD COLUMN net_amount NUMERIC(10,2);
    -- Calculate from cash_amount - processing_fee if both exist
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'payout_requests' AND column_name = 'cash_amount'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'payout_requests' AND column_name = 'processing_fee'
    ) THEN
      UPDATE payout_requests 
      SET net_amount = cash_amount - COALESCE(processing_fee, 0) 
      WHERE net_amount IS NULL;
    END IF;
  END IF;
END $$;


