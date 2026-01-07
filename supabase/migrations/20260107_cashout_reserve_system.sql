-- 1. Add reserved_troll_coins column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'reserved_troll_coins') THEN
        ALTER TABLE user_profiles ADD COLUMN reserved_troll_coins BIGINT DEFAULT 0;
    END IF;
END $$;

-- 2. Data Migration: Move pending cashout amounts to reserved state
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Process cashout_requests
    FOR r IN SELECT user_id, requested_coins FROM cashout_requests WHERE status = 'pending' LOOP
        UPDATE user_profiles
        SET 
            troll_coins = troll_coins + r.requested_coins,
            reserved_troll_coins = reserved_troll_coins + r.requested_coins
        WHERE id = r.user_id;
    END LOOP;
END $$;

-- 3. Unified submit_cashout_request (Supports Gift Cards and Manual Payouts)
CREATE OR REPLACE FUNCTION submit_cashout_request(
  p_user_id uuid,
  p_amount_coins int,
  p_usd_value numeric,
  p_provider text DEFAULT NULL,       -- Used for Gift Card Provider OR Payout Details
  p_delivery_method text DEFAULT NULL, -- Used for Delivery Method
  p_payout_method text DEFAULT 'Gift Card' -- 'Gift Card', 'PayPal', 'CashApp', etc.
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_balance int;
  v_reserved int;
  v_available int;
  v_request_id uuid;
  v_gift_card_provider text;
  v_payout_details text;
BEGIN
  -- Map parameters based on method
  IF p_payout_method = 'Gift Card' THEN
    v_gift_card_provider := p_provider;
    v_payout_details := NULL;
  ELSE
    v_gift_card_provider := NULL;
    v_payout_details := p_provider; -- For manual payouts, provider arg holds details (email/tag)
  END IF;

  -- Check balance (Total - Reserved)
  SELECT troll_coins, COALESCE(reserved_troll_coins, 0) INTO v_total_balance, v_reserved
  FROM user_profiles
  WHERE id = p_user_id;

  v_available := v_total_balance - v_reserved;

  IF v_available < p_amount_coins THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Reserve coins (Do NOT deduct from total yet)
  UPDATE user_profiles
  SET reserved_troll_coins = COALESCE(reserved_troll_coins, 0) + p_amount_coins
  WHERE id = p_user_id;

  -- Insert request
  INSERT INTO cashout_requests (
    user_id,
    requested_coins,
    usd_value,
    payout_method,
    gift_card_provider,
    payout_details, -- Ensure this column exists or use existing column mapping
    delivery_method,
    status,
    processing_time_estimate,
    created_at
  ) VALUES (
    p_user_id,
    p_amount_coins,
    p_usd_value,
    p_payout_method,
    v_gift_card_provider,
    v_payout_details,
    p_delivery_method,
    'pending',
    CASE WHEN p_payout_method = 'Gift Card' THEN 'Under 30 minutes' ELSE '24-48 hours' END,
    now()
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- 4. Cancel Cashout Request (Refunds to available by removing from reserve)
CREATE OR REPLACE FUNCTION cancel_cashout_request(
  p_request_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
BEGIN
  SELECT * INTO v_request
  FROM cashout_requests
  WHERE id = p_request_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or access denied';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be cancelled';
  END IF;

  -- Remove from reserve (unlocking the coins)
  UPDATE user_profiles
  SET reserved_troll_coins = GREATEST(0, COALESCE(reserved_troll_coins, 0) - v_request.requested_coins)
  WHERE id = p_user_id;

  -- Update status
  UPDATE cashout_requests
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_request_id;
END;
$$;

-- 5. Fulfill Cashout Request (Final deduction)
CREATE OR REPLACE FUNCTION fulfill_cashout_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_notes text DEFAULT NULL,
  p_gift_card_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Verify admin
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = p_admin_id AND (role = 'admin' OR is_admin = true)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_request
  FROM cashout_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_request.status != 'pending' AND v_request.status != 'processing' THEN
    RAISE EXCEPTION 'Request is not pending or processing';
  END IF;

  -- Finalize deduction: Remove from Total AND Reserve
  UPDATE user_profiles
  SET 
    troll_coins = troll_coins - v_request.requested_coins,
    reserved_troll_coins = GREATEST(0, COALESCE(reserved_troll_coins, 0) - v_request.requested_coins)
  WHERE id = v_request.user_id;

  -- Update status
  UPDATE cashout_requests
  SET 
    status = 'fulfilled',
    fulfilled_by = p_admin_id,
    fulfilled_at = now(),
    notes = COALESCE(p_notes, notes),
    gift_card_code = p_gift_card_code,
    updated_at = now()
  WHERE id = p_request_id;
END;
$$;

-- 6. Update process_cashout_refund to match Reserve model
CREATE OR REPLACE FUNCTION process_cashout_refund(
  p_request_id uuid,
  p_admin_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
BEGIN
  SELECT * INTO v_request
  FROM cashout_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_request.status = 'denied' OR v_request.status = 'fulfilled' OR v_request.status = 'cancelled' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  -- Unlock coins: Remove from reserve only (Total remains same)
  UPDATE user_profiles
  SET reserved_troll_coins = GREATEST(0, COALESCE(reserved_troll_coins, 0) - v_request.requested_coins)
  WHERE id = v_request.user_id;

  -- Update status
  UPDATE cashout_requests
  SET 
    status = 'denied',
    notes = p_notes,
    updated_at = now()
  WHERE id = p_request_id;
END;
$$;
