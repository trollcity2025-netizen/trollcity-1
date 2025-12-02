-- Add troller fields to user_profiles table
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_troller BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS troller_level INTEGER DEFAULT 1 CHECK (troller_level >= 1 AND troller_level <= 3);

-- Create index for troller queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_troller ON user_profiles(is_troller) WHERE is_troller = true;
CREATE INDEX IF NOT EXISTS idx_user_profiles_troller_level ON user_profiles(troller_level) WHERE is_troller = true;

-- Add comments
COMMENT ON COLUMN user_profiles.is_troller IS 'Whether user is a troller (chaos/mischief identity, no moderation powers)';
COMMENT ON COLUMN user_profiles.troller_level IS 'Troller rank: 1=Basic Troller, 2=Chaos Agent, 3=Supreme Troll';

