-- Creator Payout System
-- Created: 2025-12-12
-- Purpose: Enable creators to cash out earned coins through PayPal payouts

-- 1. Add payout-related fields to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS paypal_email TEXT,
ADD COLUMN IF NOT EXISTS payout_threshold INTEGER DEFAULT 10000, -- Minimum coins to cash out
ADD COLUMN IF NOT EXISTS total_earned_coins BIGINT DEFAULT 0, -- Total coins earned from gifts (not purchases)
ADD COLUMN IF NOT EXISTS total_paid_out BIGINT DEFAULT 0, -- Total coins already paid out
ADD COLUMN IF NOT EXISTS payout_enabled BOOLEAN DEFAULT false; -- Whether user can request payouts

-- 2. Create payout_requests table
CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  requested_coins BIGINT NOT NULL CHECK (requested_coins > 0),
  paypal_email TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected', 'failed')),
  usd_amount DECIMAL(10,2), -- Calculated USD amount for payout
  paypal_payout_id TEXT, -- PayPal payout batch ID
  paypal_fee DECIMAL(10,2), -- PayPal fees deducted
  net_amount DECIMAL(10,2), -- Amount actually paid to user
  exchange_rate DECIMAL(10,4), -- Coin to USD rate at time of request
  requested_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejected_reason TEXT,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create payout_settings table for global configuration
CREATE TABLE IF NOT EXISTS payout_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(50) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES user_profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default payout settings
INSERT INTO payout_settings (setting_key, setting_value, description) VALUES
  ('min_payout_threshold', '10000', 'Minimum coins required for payout request'),
  ('max_daily_payouts', '100', 'Maximum payout requests that can be processed per day'),
  ('coin_to_usd_rate', '0.01', 'USD value per coin (e.g., 100 coins = $1.00)'),
  ('paypal_fee_percentage', '2.9', 'PayPal fee percentage for payouts'),
  ('paypal_fixed_fee', '0.30', 'PayPal fixed fee in USD'),
  ('auto_approve_threshold', '50000', 'Auto-approve payouts below this coin amount'),
  ('max_payout_per_user_daily', '100000', 'Maximum coins a user can cash out per day'),
  ('payout_processing_delay', '24', 'Hours to wait before processing approved payouts')
ON CONFLICT (setting_key) DO NOTHING;

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id ON payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_requested_at ON payout_requests(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_requests_paypal_payout_id ON payout_requests(paypal_payout_id);

-- 5. Enable RLS
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_settings ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Users can view their own payout requests
CREATE POLICY "Users can view their own payout requests"
  ON payout_requests FOR SELECT
  USING (user_id = auth.uid());

-- Admins and Lead Officers can view all payout requests
CREATE POLICY "Admins and Lead Officers can view all payout requests"
  ON payout_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lead_officer')
    )
  );

-- Users can create their own payout requests
CREATE POLICY "Users can create payout requests"
  ON payout_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins and Lead Officers can update payout requests (approve/reject/process)
CREATE POLICY "Admins and Lead Officers can update payout requests"
  ON payout_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lead_officer')
    )
  );

-- Only admins and lead officers can view payout settings
CREATE POLICY "Admins and Lead Officers can view payout settings"
  ON payout_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lead_officer')
    )
  );

CREATE POLICY "Admins and Lead Officers can update payout settings"
  ON payout_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'lead_officer')
    )
  );

-- 7. Function to calculate available payout balance
CREATE OR REPLACE FUNCTION get_available_payout_balance(p_user_id UUID)
RETURNS TABLE (
  total_earned BIGINT,
  total_paid_out BIGINT,
  available_for_payout BIGINT,
  payout_threshold INTEGER,
  can_request_payout BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_earned BIGINT;
  v_total_paid_out BIGINT;
  v_available BIGINT;
  v_threshold INTEGER;
BEGIN
  -- Get user's total earned coins (from gifts received)
  SELECT COALESCE(total_earned_coins, 0) INTO v_total_earned
  FROM user_profiles WHERE id = p_user_id;

  -- Get total already paid out
  SELECT COALESCE(SUM(requested_coins), 0) INTO v_total_paid_out
  FROM payout_requests
  WHERE user_id = p_user_id AND status IN ('completed', 'processing');

  -- Calculate available balance
  v_available := v_total_earned - v_total_paid_out;

  -- Get payout threshold
  SELECT COALESCE(payout_threshold, 10000) INTO v_threshold
  FROM user_profiles WHERE id = p_user_id;

  RETURN QUERY SELECT
    v_total_earned,
    v_total_paid_out,
    GREATEST(v_available, 0),
    v_threshold,
    (GREATEST(v_available, 0) >= v_threshold AND payout_enabled) as can_request_payout
  FROM user_profiles WHERE id = p_user_id;
END;
$$;

-- 8. Function to request payout
CREATE OR REPLACE FUNCTION request_payout(
  p_user_id UUID,
  p_requested_coins BIGINT,
  p_paypal_email TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available BIGINT;
  v_threshold INTEGER;
  v_can_request BOOLEAN;
  v_paypal_email TEXT;
  v_coin_rate DECIMAL(10,4) := 0.01; -- Default $0.01 per coin
  v_usd_amount DECIMAL(10,2);
  v_paypal_fee_pct DECIMAL(10,2) := 2.9;
  v_paypal_fixed_fee DECIMAL(10,2) := 0.30;
  v_paypal_fee DECIMAL(10,2);
  v_net_amount DECIMAL(10,2);
  v_request_id UUID;
BEGIN
  -- Get user's payout balance
  SELECT available_for_payout, payout_threshold, can_request_payout
  INTO v_available, v_threshold, v_can_request
  FROM get_available_payout_balance(p_user_id);

  -- Validate request
  IF NOT v_can_request THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout not available or below threshold');
  END IF;

  IF p_requested_coins > v_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Requested amount exceeds available balance');
  END IF;

  IF p_requested_coins < v_threshold THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount below minimum threshold');
  END IF;

  -- Get PayPal email
  IF p_paypal_email IS NOT NULL THEN
    v_paypal_email := p_paypal_email;
  ELSE
    SELECT paypal_email INTO v_paypal_email
    FROM user_profiles WHERE id = p_user_id;
  END IF;

  IF v_paypal_email IS NULL OR v_paypal_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PayPal email required for payout');
  END IF;

  -- Get current coin to USD rate
  SELECT COALESCE(CAST(setting_value AS DECIMAL(10,4)), 0.01) INTO v_coin_rate
  FROM payout_settings WHERE setting_key = 'coin_to_usd_rate';

  -- Calculate amounts
  v_usd_amount := (p_requested_coins::DECIMAL(10,2) * v_coin_rate);
  v_paypal_fee := (v_usd_amount * v_paypal_fee_pct / 100) + v_paypal_fixed_fee;
  v_net_amount := v_usd_amount - v_paypal_fee;

  -- Check minimum payout amount
  IF v_net_amount < 1.00 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Net payout amount too low (minimum $1.00)');
  END IF;

  -- Check daily limits
  IF EXISTS (
    SELECT 1 FROM payout_requests
    WHERE user_id = p_user_id
      AND DATE(requested_at) = CURRENT_DATE
      AND requested_coins >= (
        SELECT CAST(setting_value AS BIGINT)
        FROM payout_settings
        WHERE setting_key = 'max_payout_per_user_daily'
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily payout limit exceeded');
  END IF;

  -- Create payout request
  INSERT INTO payout_requests (
    user_id,
    requested_coins,
    paypal_email,
    usd_amount,
    paypal_fee,
    net_amount,
    exchange_rate
  ) VALUES (
    p_user_id,
    p_requested_coins,
    v_paypal_email,
    v_usd_amount,
    v_paypal_fee,
    v_net_amount,
    v_coin_rate
  ) RETURNING id INTO v_request_id;

  -- Auto-approve small payouts
  DECLARE
    v_auto_approve_threshold BIGINT;
  BEGIN
    SELECT CAST(setting_value AS BIGINT) INTO v_auto_approve_threshold
    FROM payout_settings WHERE setting_key = 'auto_approve_threshold';

    IF p_requested_coins <= v_auto_approve_threshold THEN
      UPDATE payout_requests
      SET status = 'approved', reviewed_by = p_user_id, updated_at = now()
      WHERE id = v_request_id;
    END IF;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'requested_coins', p_requested_coins,
    'usd_amount', v_usd_amount,
    'paypal_fee', v_paypal_fee,
    'net_amount', v_net_amount,
    'auto_approved', (p_requested_coins <= v_auto_approve_threshold)
  );
END;
$$;

-- 9. Function to process approved payouts (admin only)
CREATE OR REPLACE FUNCTION process_payout(p_request_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_paypal_batch_id TEXT;
  v_processing_delay INTEGER;
BEGIN
  -- Check admin/lead officer permissions
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'lead_officer')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin or Lead Officer access required');
  END IF;

  -- Get payout request
  SELECT * INTO v_request
  FROM payout_requests
  WHERE id = p_request_id AND status = 'approved';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Approved payout request not found');
  END IF;

  -- Check processing delay
  SELECT CAST(setting_value AS INTEGER) INTO v_processing_delay
  FROM payout_settings WHERE setting_key = 'payout_processing_delay';

  IF EXTRACT(EPOCH FROM (now() - v_request.requested_at)) / 3600 < v_processing_delay THEN
    RETURN jsonb_build_object('success', false, 'error', 'Processing delay not met');
  END IF;

  -- Update status to processing
  UPDATE payout_requests
  SET status = 'processing', processed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  -- Here you would integrate with PayPal Payouts API
  -- For now, we'll simulate the PayPal batch ID
  v_paypal_batch_id := 'PPB' || UPPER(SUBSTRING(MD5(random()::text) FROM 1 FOR 10));

  -- Update with PayPal batch ID
  UPDATE payout_requests
  SET paypal_payout_id = v_paypal_batch_id, updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'paypal_batch_id', v_paypal_batch_id,
    'status', 'processing'
  );
END;
$$;

-- 10. Function to complete payout (called by webhook or manual)
CREATE OR REPLACE FUNCTION complete_payout(p_paypal_batch_id TEXT, p_success BOOLEAN DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Find the payout request
  SELECT * INTO v_request
  FROM payout_requests
  WHERE paypal_payout_id = p_paypal_batch_id AND status = 'processing';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout request not found');
  END IF;

  IF p_success THEN
    -- Mark as completed
    UPDATE payout_requests
    SET status = 'completed', completed_at = now(), updated_at = now()
    WHERE id = v_request.id;

    -- Update user's paid_out total
    UPDATE user_profiles
    SET total_paid_out = total_paid_out + v_request.requested_coins,
        updated_at = now()
    WHERE id = v_request.user_id;

    RETURN jsonb_build_object(
      'success', true,
      'request_id', v_request.id,
      'status', 'completed',
      'user_id', v_request.user_id,
      'amount_paid', v_request.net_amount
    );
  ELSE
    -- Mark as failed
    UPDATE payout_requests
    SET status = 'failed', updated_at = now()
    WHERE id = v_request.id;

    RETURN jsonb_build_object(
      'success', false,
      'request_id', v_request.id,
      'status', 'failed'
    );
  END IF;
END;
$$;

-- 11. Function to get payout statistics
CREATE OR REPLACE FUNCTION get_payout_stats(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_requested BIGINT,
  total_completed BIGINT,
  total_pending BIGINT,
  total_failed BIGINT,
  total_earned BIGINT,
  available_balance BIGINT,
  pending_payouts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    p_user_id := auth.uid();
  END IF;

  -- Check permissions
  IF p_user_id != auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN status IN ('pending', 'approved', 'processing', 'completed') THEN requested_coins END), 0)::BIGINT as total_requested,
    COALESCE(SUM(CASE WHEN status = 'completed' THEN requested_coins END), 0)::BIGINT as total_completed,
    COALESCE(SUM(CASE WHEN status IN ('pending', 'approved') THEN requested_coins END), 0)::BIGINT as total_pending,
    COALESCE(SUM(CASE WHEN status = 'failed' THEN requested_coins END), 0)::BIGINT as total_failed,
    COALESCE(up.total_earned_coins, 0)::BIGINT as total_earned,
    GREATEST(COALESCE(up.total_earned_coins, 0) - COALESCE(up.total_paid_out, 0), 0)::BIGINT as available_balance,
    COUNT(CASE WHEN status IN ('pending', 'approved', 'processing') THEN 1 END)::INTEGER as pending_payouts
  FROM payout_requests pr
  FULL OUTER JOIN user_profiles up ON up.id = p_user_id
  WHERE pr.user_id = p_user_id OR pr.user_id IS NULL;
END;
$$;

-- 12. Grant permissions
GRANT EXECUTE ON FUNCTION get_available_payout_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION request_payout(UUID, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_payout(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_payout(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_payout_stats(UUID) TO authenticated;

GRANT SELECT ON payout_requests TO authenticated;
GRANT SELECT ON payout_settings TO authenticated;

-- 13. Add comments
COMMENT ON TABLE payout_requests IS 'Tracks creator payout requests and their processing status';
COMMENT ON TABLE payout_settings IS 'Global configuration for payout system parameters';
COMMENT ON FUNCTION get_available_payout_balance IS 'Calculates user available payout balance';
COMMENT ON FUNCTION request_payout IS 'Creates a new payout request with validation';
COMMENT ON FUNCTION process_payout IS 'Processes approved payouts through PayPal';
COMMENT ON FUNCTION complete_payout IS 'Completes payout processing (webhook callback)';
COMMENT ON FUNCTION get_payout_stats IS 'Returns payout statistics for user or admin view';

-- 14. Create view for payout dashboard
CREATE OR REPLACE VIEW payout_dashboard AS
SELECT
  pr.*,
  up.username,
  up.avatar_url,
  up.total_earned_coins,
  up.total_paid_out
FROM payout_requests pr
LEFT JOIN user_profiles up ON pr.user_id = up.id
ORDER BY pr.requested_at DESC;

GRANT SELECT ON payout_dashboard TO authenticated;

-- 15. Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_payout_enabled ON user_profiles(payout_enabled) WHERE payout_enabled = true;