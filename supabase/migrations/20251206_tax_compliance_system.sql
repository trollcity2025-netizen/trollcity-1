-- Tax Compliance System
-- Tracks W-9 form submissions and blocks payouts until approved
--
-- IMPORTANT: Create Supabase Storage bucket before using this system:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Create new bucket: "tax_forms"
-- 3. Set to "Private" (not public)
-- 4. Add RLS policy to allow authenticated users to upload their own files

-- Add tax status columns to user_profiles
DO $$
BEGIN
  -- Add tax_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'tax_status'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN tax_status text DEFAULT 'not_required' 
    CHECK (tax_status IN ('not_required', 'required', 'submitted', 'approved', 'rejected'));
  END IF;

  -- Add tax_form_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'tax_form_url'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN tax_form_url text;
  END IF;

  -- Add tax_last_updated column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'tax_last_updated'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN tax_last_updated timestamptz;
  END IF;
END $$;

-- Create index for tax status queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_tax_status ON user_profiles(tax_status);

-- Admin view for tax form reviews
CREATE OR REPLACE VIEW admin_tax_reviews AS
SELECT 
  id,
  username,
  tax_status,
  tax_form_url,
  tax_last_updated,
  created_at,
  paid_coin_balance,
  total_earned_coins
FROM user_profiles
WHERE tax_status IN ('submitted', 'rejected')
ORDER BY tax_last_updated DESC NULLS LAST;

-- Grant access
GRANT SELECT ON admin_tax_reviews TO authenticated;

-- Function to auto-set tax_status to 'required' when user crosses $600 threshold
-- This will be called by a trigger or manually by admin
CREATE OR REPLACE FUNCTION check_tax_status_requirement()
RETURNS TRIGGER AS $$
DECLARE
  yearly_payouts numeric;
BEGIN
  -- Check if user has earned $600+ in payouts this year
  SELECT COALESCE(SUM(amount_usd), 0) INTO yearly_payouts
  FROM payout_requests
  WHERE user_id = NEW.user_id
    AND status = 'paid'
    AND DATE_PART('year', created_at) = DATE_PART('year', NOW());

  -- If over $600 and status is still 'not_required', set to 'required'
  IF yearly_payouts >= 600 AND NEW.tax_status = 'not_required' THEN
    NEW.tax_status := 'required';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to check tax status when payout is marked as paid
CREATE OR REPLACE FUNCTION trigger_check_tax_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check if payout status changed to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- Update user's tax_status if they cross $600 threshold
    UPDATE user_profiles
    SET tax_status = CASE
      WHEN tax_status = 'not_required' AND (
        SELECT COALESCE(SUM(amount_usd), 0)
        FROM payout_requests
        WHERE user_id = NEW.user_id
          AND status = 'paid'
          AND DATE_PART('year', created_at) = DATE_PART('year', NOW())
      ) >= 600
      THEN 'required'
      ELSE tax_status
    END
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS check_tax_status_on_payout ON payout_requests;
CREATE TRIGGER check_tax_status_on_payout
  AFTER INSERT OR UPDATE ON payout_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_tax_status();

-- RPC function for admin to approve/reject tax forms
CREATE OR REPLACE FUNCTION approve_tax_form(user_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles
  SET 
    tax_status = 'approved',
    tax_last_updated = NOW()
  WHERE id = user_id_input;
END;
$$;

CREATE OR REPLACE FUNCTION reject_tax_form(user_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles
  SET 
    tax_status = 'rejected',
    tax_last_updated = NOW()
  WHERE id = user_id_input;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION approve_tax_form(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION reject_tax_form(uuid) TO service_role;

