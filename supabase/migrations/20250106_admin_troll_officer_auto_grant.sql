-- Auto-grant troll_officer status to admins
-- Admins get troll_officer privileges but don't need quiz and don't get paid for shifts

-- Update existing admins to have troll_officer status and be active (no quiz needed)
UPDATE user_profiles
SET 
  is_troll_officer = TRUE,
  is_officer_active = TRUE,  -- Admins are immediately active (no quiz)
  role = CASE 
    WHEN role = 'admin' THEN 'admin'  -- Keep admin role
    ELSE role
  END,
  updated_at = NOW()
WHERE (role = 'admin' OR is_admin = TRUE)
  AND (is_troll_officer = FALSE OR is_officer_active = FALSE);

-- Create trigger to auto-grant troll_officer to new admins
CREATE OR REPLACE FUNCTION auto_grant_admin_officer_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If user becomes admin, automatically grant troll_officer and activate
  IF (NEW.role = 'admin' OR NEW.is_admin = TRUE) THEN
    NEW.is_troll_officer := TRUE;
    NEW.is_officer_active := TRUE;  -- Admins don't need quiz
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_auto_grant_admin_officer ON user_profiles;
CREATE TRIGGER trigger_auto_grant_admin_officer
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_grant_admin_officer_status();

COMMENT ON FUNCTION auto_grant_admin_officer_status IS 'Automatically grants troll_officer status and activates admins (no quiz required)';

