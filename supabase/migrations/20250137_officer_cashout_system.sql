-- Officer Cashout System
-- Officers can cash out after clocking out from a shift
-- Rate: 6,000 paid coins = $60

-- Create officer_payouts table if it doesn't exist
CREATE TABLE IF NOT EXISTS officer_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  shift_log_id UUID REFERENCES officer_shift_logs(id) ON DELETE SET NULL,
  free_coins_redeemed BIGINT NOT NULL,
  paid_coins_received INTEGER NOT NULL,
  usd_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  admin_id UUID REFERENCES user_profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_officer_payouts_officer ON officer_payouts(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_payouts_status ON officer_payouts(status);
CREATE INDEX IF NOT EXISTS idx_officer_payouts_shift ON officer_payouts(shift_log_id);

-- Enable RLS
ALTER TABLE officer_payouts ENABLE ROW LEVEL SECURITY;

-- Officers can view their own payouts
CREATE POLICY "Officers can view own payouts"
  ON officer_payouts FOR SELECT
  USING (officer_id = auth.uid());

-- Officers can insert their own payouts
CREATE POLICY "Officers can insert own payouts"
  ON officer_payouts FOR INSERT
  WITH CHECK (officer_id = auth.uid());

-- Admins can view all payouts
CREATE POLICY "Admins can view all officer payouts"
  ON officer_payouts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

GRANT ALL ON officer_payouts TO authenticated;

-- Function to cash out after shift
CREATE OR REPLACE FUNCTION officer_cashout_after_shift(
  p_shift_log_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_log RECORD;
  v_officer RECORD;
  v_free_coins BIGINT;
  v_paid_coins INTEGER;
  v_usd_amount NUMERIC(10,2);
  v_exchange_rate NUMERIC := 100.0; -- 6,000 paid coins = $60, so 100 paid coins = $1
  v_payout_id UUID;
BEGIN
  -- Get shift log details
  SELECT * INTO v_shift_log
  FROM officer_shift_logs
  WHERE id = p_shift_log_id;

  IF v_shift_log IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift log not found');
  END IF;

  -- Check if shift is completed
  IF v_shift_log.shift_end IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift must be completed before cashing out');
  END IF;

  -- Check if already cashed out
  IF EXISTS (SELECT 1 FROM officer_payouts WHERE shift_log_id = p_shift_log_id AND status != 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'This shift has already been cashed out');
  END IF;

  -- Get officer profile
  SELECT * INTO v_officer
  FROM user_profiles
  WHERE id = v_shift_log.officer_id;

  IF v_officer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Officer profile not found');
  END IF;

  -- Check if user is an officer
  IF NOT (v_officer.is_troll_officer = true OR v_officer.role = 'troll_officer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only troll officers can cash out');
  END IF;

  -- Get coins earned from shift
  v_free_coins := COALESCE(v_shift_log.coins_earned, 0);

  IF v_free_coins <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No coins earned from this shift');
  END IF;

  -- Check if officer has enough free coins
  IF (v_officer.free_coin_balance < v_free_coins) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient free coins. You may have already cashed out or spent them.');
  END IF;

  -- Calculate conversion: 6,000 paid coins = $60
  -- So 100 paid coins = $1
  -- Free coins to paid coins: 1 free coin = 1 paid coin (1:1 ratio)
  -- But we need to convert to USD: 6,000 paid coins = $60, so 100 paid coins = $1
  v_paid_coins := v_free_coins; -- 1:1 conversion
  v_usd_amount := (v_paid_coins::NUMERIC / 100.0); -- 100 paid coins = $1

  -- Deduct free coins and add paid coins
  UPDATE user_profiles
  SET 
    free_coin_balance = free_coin_balance - v_free_coins,
    paid_coin_balance = paid_coin_balance + v_paid_coins,
    updated_at = NOW()
  WHERE id = v_officer.id;

  -- Create payout record
  INSERT INTO officer_payouts (
    officer_id,
    shift_log_id,
    free_coins_redeemed,
    paid_coins_received,
    usd_amount,
    status,
    requested_at
  ) VALUES (
    v_officer.id,
    p_shift_log_id,
    v_free_coins,
    v_paid_coins,
    v_usd_amount,
    'pending',
    NOW()
  ) RETURNING id INTO v_payout_id;

  -- Record transaction
  INSERT INTO coin_transactions (
    user_id,
    type,
    amount,
    description,
    metadata
  ) VALUES (
    v_officer.id,
    'officer_cashout',
    v_paid_coins,
    format('Officer cashout: %s free coins converted to %s paid coins ($%s)', 
           v_free_coins, v_paid_coins, v_usd_amount),
    jsonb_build_object(
      'shift_log_id', p_shift_log_id,
      'payout_id', v_payout_id,
      'free_coins_redeemed', v_free_coins,
      'paid_coins_received', v_paid_coins,
      'usd_amount', v_usd_amount
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Successfully cashed out %s free coins for %s paid coins ($%s)', 
                     v_free_coins, v_paid_coins, v_usd_amount),
    'payout_id', v_payout_id,
    'free_coins_redeemed', v_free_coins,
    'paid_coins_received', v_paid_coins,
    'usd_amount', v_usd_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION officer_cashout_after_shift(UUID) TO authenticated;

-- Function to get cashout history for an officer
CREATE OR REPLACE FUNCTION get_officer_cashout_history(
  p_officer_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  shift_log_id UUID,
  free_coins_redeemed BIGINT,
  paid_coins_received INTEGER,
  usd_amount NUMERIC(10,2),
  status TEXT,
  requested_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    op.id,
    op.shift_log_id,
    op.free_coins_redeemed,
    op.paid_coins_received,
    op.usd_amount,
    op.status,
    op.requested_at,
    op.processed_at
  FROM officer_payouts op
  WHERE op.officer_id = p_officer_id
  ORDER BY op.requested_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_officer_cashout_history(UUID, INTEGER) TO authenticated;

COMMENT ON TABLE officer_payouts IS 'Tracks officer cashouts after completed shifts';
COMMENT ON FUNCTION officer_cashout_after_shift IS 'Allows officers to cash out free coins earned from a shift into paid coins';
COMMENT ON FUNCTION get_officer_cashout_history IS 'Returns cashout history for an officer';

