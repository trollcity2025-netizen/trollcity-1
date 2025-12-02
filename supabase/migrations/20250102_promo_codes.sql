-- Promo Code System for Coin Store
-- Empire Partner only codes for testing: 2025 (50% off), 1903 (100% off)

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount NUMERIC(10,2), -- Fixed dollar discount (optional)
  is_active BOOLEAN DEFAULT true,
  is_empire_partner_only BOOLEAN DEFAULT false,
  max_uses INTEGER, -- NULL = unlimited
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active, valid_until);

-- Enable RLS
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Public read access for active codes (for validation)
CREATE POLICY "Public can view active promo codes"
  ON promo_codes FOR SELECT
  USING (is_active = true AND (valid_until IS NULL OR valid_until > NOW()));

-- Track promo code usage
CREATE TABLE IF NOT EXISTS promo_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  transaction_id UUID, -- Reference to coin_transactions or payment_transactions
  discount_applied NUMERIC(10,2),
  original_price NUMERIC(10,2),
  final_price NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(promo_code_id, user_id) -- One use per user per code (unless max_uses allows multiple)
);

CREATE INDEX IF NOT EXISTS idx_promo_code_uses_user ON promo_code_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_code ON promo_code_uses(promo_code_id);

-- Enable RLS
ALTER TABLE promo_code_uses ENABLE ROW LEVEL SECURITY;

-- Users can view their own promo code uses
CREATE POLICY "Users can view own promo code uses"
  ON promo_code_uses FOR SELECT
  USING (user_id = auth.uid());

-- Function to validate and apply promo code
CREATE OR REPLACE FUNCTION validate_promo_code(
  p_code TEXT,
  p_user_id UUID,
  p_original_price NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo RECORD;
  v_user_is_empire_partner BOOLEAN;
  v_has_used_code BOOLEAN;
  v_discount_amount NUMERIC;
  v_final_price NUMERIC;
BEGIN
  -- Get promo code
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE code = UPPER(TRIM(p_code))
    AND is_active = true
    AND (valid_until IS NULL OR valid_until > NOW())
    AND (valid_from IS NULL OR valid_from <= NOW());

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired promo code'
    );
  END IF;

  -- Check if user is empire partner (if required)
  IF v_promo.is_empire_partner_only THEN
    SELECT COALESCE(is_empire_partner, false) INTO v_user_is_empire_partner
    FROM user_profiles
    WHERE id = p_user_id;

    IF NOT v_user_is_empire_partner THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This promo code is only available for Empire Partners'
      );
    END IF;
  END IF;

  -- Check max uses
  IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This promo code has reached its usage limit'
    );
  END IF;

  -- Check if user has already used this code (one-time use per user)
  SELECT EXISTS(
    SELECT 1 FROM promo_code_uses
    WHERE promo_code_id = v_promo.id AND user_id = p_user_id
  ) INTO v_has_used_code;

  IF v_has_used_code THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You have already used this promo code'
    );
  END IF;

  -- Calculate discount
  IF v_promo.discount_percent > 0 THEN
    v_discount_amount := (p_original_price * v_promo.discount_percent / 100.0);
  ELSIF v_promo.discount_amount IS NOT NULL THEN
    v_discount_amount := LEAST(v_promo.discount_amount, p_original_price);
  ELSE
    v_discount_amount := 0;
  END IF;

  v_final_price := GREATEST(0, p_original_price - v_discount_amount);

  RETURN jsonb_build_object(
    'success', true,
    'promo_id', v_promo.id,
    'code', v_promo.code,
    'discount_percent', v_promo.discount_percent,
    'discount_amount', v_discount_amount,
    'original_price', p_original_price,
    'final_price', v_final_price
  );
END;
$$;

GRANT EXECUTE ON FUNCTION validate_promo_code(TEXT, UUID, NUMERIC) TO authenticated;

-- Function to record promo code usage
CREATE OR REPLACE FUNCTION record_promo_code_use(
  p_promo_code_id UUID,
  p_user_id UUID,
  p_discount_applied NUMERIC,
  p_original_price NUMERIC,
  p_final_price NUMERIC,
  p_transaction_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_use_id UUID;
BEGIN
  -- Insert usage record
  INSERT INTO promo_code_uses (
    promo_code_id,
    user_id,
    transaction_id,
    discount_applied,
    original_price,
    final_price
  ) VALUES (
    p_promo_code_id,
    p_user_id,
    p_transaction_id,
    p_discount_applied,
    p_original_price,
    p_final_price
  )
  RETURNING id INTO v_use_id;

  -- Increment usage count
  UPDATE promo_codes
  SET current_uses = current_uses + 1,
      updated_at = NOW()
  WHERE id = p_promo_code_id;

  RETURN v_use_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_promo_code_use(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, UUID) TO authenticated;

-- Insert test promo codes (Empire Partner only)
INSERT INTO promo_codes (code, discount_percent, is_empire_partner_only, max_uses, valid_until)
VALUES 
  ('2025', 50, true, NULL, NULL), -- 50% off, unlimited uses
  ('1903', 100, true, NULL, NULL) -- 100% off, unlimited uses
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE promo_codes IS 'Promo codes for coin store discounts. Empire Partner codes are test codes.';
COMMENT ON TABLE promo_code_uses IS 'Tracks promo code usage by users';

