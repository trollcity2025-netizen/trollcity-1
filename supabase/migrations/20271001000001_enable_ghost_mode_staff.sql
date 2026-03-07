-- Enable automatic ghost mode for staff roles only (admin, secretary, lead_officer, officer)
-- Regular users only get ghost mode when they win it from the Troll Wheel

-- Update staff roles to have ghost mode enabled
UPDATE user_profiles
SET ghost_mode_until = NOW() + INTERVAL '100 years'
WHERE (
  role IN ('admin', 'secretary', 'lead_officer', 'officer')
  OR is_admin = true
  OR is_lead_officer = true
)
AND (ghost_mode_until IS NULL OR ghost_mode_until < NOW());

-- Set default ghost_mode for new staff users (via trigger)
CREATE OR REPLACE FUNCTION set_default_staff_ghost_mode()
RETURNS TRIGGER AS $$
BEGIN
  -- Set ghost mode by default for staff roles
  IF NEW.role IN ('admin', 'secretary', 'lead_officer', 'officer') 
     OR NEW.is_admin = true 
     OR NEW.is_lead_officer = true THEN
    NEW.ghost_mode_until := NOW() + INTERVAL '100 years';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS tr_set_default_staff_ghost_mode ON user_profiles;

-- Create trigger
CREATE TRIGGER tr_set_default_staff_ghost_mode
BEFORE INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION set_default_staff_ghost_mode();

-- Note: Only staff roles (admin, secretary, lead_officer, officer) get automatic ghost mode
-- Regular users only get ghost mode when they win it from the Troll Wheel
