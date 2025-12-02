-- Add is_admin field to user_profiles table
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Set is_admin based on existing role field
UPDATE user_profiles
SET is_admin = true
WHERE role = 'admin';

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin ON user_profiles(is_admin) WHERE is_admin = true;

-- Add comment
COMMENT ON COLUMN user_profiles.is_admin IS 'Whether user is an admin (highest privilege level)';

