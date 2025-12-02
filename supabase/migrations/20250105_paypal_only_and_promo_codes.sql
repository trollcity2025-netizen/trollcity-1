-- PayPal Only System + Promo Codes
-- Remove Square references, add PayPal support, add promo codes

-- Update coin_transactions for PayPal
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'payment_provider') THEN
    ALTER TABLE coin_transactions ADD COLUMN payment_provider TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'paypal_order_id') THEN
    ALTER TABLE coin_transactions ADD COLUMN paypal_order_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'amount_usd') THEN
    ALTER TABLE coin_transactions ADD COLUMN amount_usd NUMERIC(10,2);
  END IF;
END $$;

-- Create promo_codes table if it doesn't exist
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active, expires_at);

-- Create promo_code_uses table if it doesn't exist
CREATE TABLE IF NOT EXISTS promo_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  transaction_id UUID REFERENCES coin_transactions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_promo_code_uses_user ON promo_code_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_code ON promo_code_uses(promo_code_id);

-- Function to validate promo code
CREATE OR REPLACE FUNCTION validate_promo_code(p_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
  v_user_uses INTEGER;
BEGIN
  -- Find promo code
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN json_build_object(
      'valid', false,
      'message', 'Invalid or expired promo code'
    );
  END IF;

  -- Check max uses
  IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
    RETURN json_build_object(
      'valid', false,
      'message', 'Promo code has reached maximum uses'
    );
  END IF;

  RETURN json_build_object(
    'valid', true,
    'discount_percent', v_promo.discount_percent,
    'code', v_promo.code
  );
END;
$$ LANGUAGE plpgsql;

-- Function to record promo code use
CREATE OR REPLACE FUNCTION record_promo_code_use(
  p_code TEXT,
  p_user_id UUID,
  p_transaction_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_promo_id UUID;
BEGIN
  -- Get promo code ID
  SELECT id INTO v_promo_id
  FROM promo_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND is_active = TRUE;

  IF v_promo_id IS NULL THEN
    RAISE EXCEPTION 'Promo code not found';
  END IF;

  -- Record use
  INSERT INTO promo_code_uses (promo_code_id, user_id, transaction_id)
  VALUES (v_promo_id, p_user_id, p_transaction_id);

  -- Increment use count
  UPDATE promo_codes
  SET current_uses = current_uses + 1
  WHERE id = v_promo_id;
END;
$$ LANGUAGE plpgsql;

-- Seed promo codes
INSERT INTO promo_codes (code, discount_percent, max_uses, is_active)
VALUES 
  ('2025', 5, NULL, TRUE),
  ('1903', 100, NULL, TRUE)
ON CONFLICT (code) DO UPDATE SET
  discount_percent = EXCLUDED.discount_percent,
  is_active = EXCLUDED.is_active;

