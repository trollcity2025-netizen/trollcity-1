-- Ensure promo_codes table exists (re-run if needed)
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  is_empire_partner_only BOOLEAN DEFAULT false,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active, valid_until);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Recreate policy if it doesn't exist
DROP POLICY IF EXISTS "Public can view active promo codes" ON promo_codes;
CREATE POLICY "Public can view active promo codes"
  ON promo_codes FOR SELECT
  USING (is_active = true AND (valid_until IS NULL OR valid_until > NOW()));

-- Ensure promo_code_uses exists
CREATE TABLE IF NOT EXISTS promo_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  transaction_id UUID,
  discount_applied NUMERIC(10,2),
  original_price NUMERIC(10,2),
  final_price NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(promo_code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_code_uses_user ON promo_code_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_code ON promo_code_uses(promo_code_id);

ALTER TABLE promo_code_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own promo code uses" ON promo_code_uses;
CREATE POLICY "Users can view own promo code uses"
  ON promo_code_uses FOR SELECT
  USING (user_id = auth.uid());

