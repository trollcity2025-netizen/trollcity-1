-- Fix Empire Partner to use empire_role column instead of is_empire_partner
-- Step 1: Add empire_role column if it doesn't exist
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS empire_role text;

-- Step 2: Update existing is_empire_partner to empire_role
UPDATE user_profiles
SET empire_role = 'partner'
WHERE is_empire_partner = TRUE AND (empire_role IS NULL OR empire_role != 'partner');

-- Step 3: Update approve_empire_partner function to set empire_role
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
  
  -- Update user profile - SET empire_role = 'partner'
  UPDATE user_profiles
  SET empire_role = 'partner'
  WHERE id = v_user_id;
END;
$$;

-- Step 4: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_empire_role ON user_profiles(empire_role);

-- Step 5: Add constraint to ensure valid values
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS check_empire_role;

ALTER TABLE user_profiles
ADD CONSTRAINT check_empire_role 
CHECK (empire_role IS NULL OR empire_role IN ('partner'));

COMMENT ON COLUMN user_profiles.empire_role IS 'Empire Partner role status. Set to "partner" when approved.';

