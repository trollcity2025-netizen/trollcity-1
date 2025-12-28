-- User Verification System
-- Add verification columns to user_profiles
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_verified') THEN
    ALTER TABLE user_profiles ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'verification_date') THEN
    ALTER TABLE user_profiles ADD COLUMN verification_date TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'verification_paid_amount') THEN
    ALTER TABLE user_profiles ADD COLUMN verification_paid_amount NUMERIC(10, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'verification_payment_method') THEN
    ALTER TABLE user_profiles ADD COLUMN verification_payment_method TEXT;
  END IF;
END $$;

-- Create verification_transactions table for audit trail
CREATE TABLE IF NOT EXISTS verification_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL, -- 'paypal' or 'coins'
  amount NUMERIC(10, 2) NOT NULL,
  payment_reference TEXT, -- PayPal transaction ID or coin transaction ID
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_transactions_user ON verification_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_transactions_created ON verification_transactions(created_at DESC);

-- RPC function to verify user
CREATE OR REPLACE FUNCTION verify_user(
  p_user_id UUID,
  p_payment_method TEXT,
  p_amount NUMERIC,
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_current_status BOOLEAN;
BEGIN
  -- Get current verification status
  SELECT is_verified INTO v_current_status
  FROM user_profiles
  WHERE id = p_user_id;

  -- If already verified, return early
  IF v_current_status = TRUE THEN
    RETURN json_build_object('success', false, 'error', 'User already verified');
  END IF;

  -- Update user profile
  UPDATE user_profiles
  SET 
    is_verified = TRUE,
    verification_date = NOW(),
    verification_paid_amount = p_amount,
    verification_payment_method = p_payment_method,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Log transaction
  INSERT INTO verification_transactions (user_id, payment_method, amount, payment_reference, status)
  VALUES (p_user_id, p_payment_method, p_amount, p_payment_reference, 'completed');

  RETURN json_build_object('success', true, 'verified', TRUE);
END;
$$ LANGUAGE plpgsql;

-- RPC function to remove verification (admin only)
CREATE OR REPLACE FUNCTION remove_verification(p_user_id UUID)
RETURNS JSON AS $$
BEGIN
  UPDATE user_profiles
  SET 
    is_verified = FALSE,
    verification_date = NULL,
    verification_paid_amount = NULL,
    verification_payment_method = NULL,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Auto-remove verification on permanent ban
CREATE OR REPLACE FUNCTION auto_remove_verification_on_ban()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_banned = TRUE AND NEW.ban_expires_at IS NULL THEN
    -- Permanent ban - remove verification
    UPDATE user_profiles
    SET 
      is_verified = FALSE,
      verification_date = NULL,
      updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS trigger_auto_remove_verification ON user_profiles;
CREATE TRIGGER trigger_auto_remove_verification
  AFTER UPDATE OF is_banned, ban_expires_at ON user_profiles
  FOR EACH ROW
  WHEN (NEW.is_banned = TRUE AND NEW.ban_expires_at IS NULL)
  EXECUTE FUNCTION auto_remove_verification_on_ban();

