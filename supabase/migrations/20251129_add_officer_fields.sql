-- Add officer fields to user_profiles table
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_troll_officer BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS officer_level INTEGER DEFAULT 1 CHECK (officer_level >= 1 AND officer_level <= 3);

-- Set is_troll_officer based on existing role field
UPDATE user_profiles
SET is_troll_officer = true
WHERE role IN ('troll_officer', 'admin');

-- Set officer_level for admins (level 3 = Commander)
UPDATE user_profiles
SET officer_level = 3
WHERE role = 'admin' AND is_troll_officer = true;

-- Create index for officer queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_officer ON user_profiles(is_troll_officer) WHERE is_troll_officer = true;
CREATE INDEX IF NOT EXISTS idx_user_profiles_officer_level ON user_profiles(officer_level) WHERE is_troll_officer = true;

-- Add comments
COMMENT ON COLUMN user_profiles.is_troll_officer IS 'Whether user is a troll officer';
COMMENT ON COLUMN user_profiles.officer_level IS 'Officer rank: 1=Officer, 2=Senior Officer, 3=Commander';

