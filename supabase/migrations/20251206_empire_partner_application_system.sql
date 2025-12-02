-- Troll Empire Partner Program: Application System
-- Requires users to apply and pay a fee before becoming Empire Partners

-- Add is_empire_partner flag to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_empire_partner boolean NOT NULL DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_empire_partner ON user_profiles(is_empire_partner);

-- Table to track Empire Partner applications
CREATE TABLE IF NOT EXISTS empire_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  payment_type text NOT NULL CHECK (payment_type IN ('paid_coins', 'card_payment')),
  amount_paid numeric(10,2) NOT NULL, -- $15 for card, 1500 for coins
  payment_id text, -- Square payment ID or transaction ID
  reviewed_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id) -- One application per user
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_empire_applications_user_id ON empire_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_empire_applications_status ON empire_applications(status);
CREATE INDEX IF NOT EXISTS idx_empire_applications_reviewed_by ON empire_applications(reviewed_by);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_empire_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_empire_applications_updated_at ON empire_applications;
CREATE TRIGGER set_empire_applications_updated_at
  BEFORE UPDATE ON empire_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_empire_applications_updated_at();

-- Function to approve Empire Partner application
CREATE OR REPLACE FUNCTION approve_empire_partner(p_application_id uuid, p_reviewer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get user_id from application
  SELECT user_id INTO v_user_id
  FROM empire_applications
  WHERE id = p_application_id AND status = 'pending';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Application not found or already processed';
  END IF;
  
  -- Update application status
  UPDATE empire_applications
  SET 
    status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW()
  WHERE id = p_application_id;
  
  -- Update user profile
  UPDATE user_profiles
  SET is_empire_partner = true
  WHERE id = v_user_id;
END;
$$;

-- Function to reject Empire Partner application
CREATE OR REPLACE FUNCTION reject_empire_partner(p_application_id uuid, p_reviewer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE empire_applications
  SET 
    status = 'rejected',
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW()
  WHERE id = p_application_id
    AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found or already processed';
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION approve_empire_partner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION reject_empire_partner(uuid, uuid) TO authenticated, service_role;

-- Comments for documentation
COMMENT ON TABLE empire_applications IS 'Tracks Empire Partner Program applications and payments';
COMMENT ON COLUMN user_profiles.is_empire_partner IS 'Indicates if user is an approved Empire Partner eligible for referral bonuses';
COMMENT ON FUNCTION approve_empire_partner IS 'Approves an Empire Partner application and updates user profile';
COMMENT ON FUNCTION reject_empire_partner IS 'Rejects an Empire Partner application';

