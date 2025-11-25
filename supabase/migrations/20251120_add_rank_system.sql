-- Add rank column to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS rank VARCHAR(50) DEFAULT NULL;

-- Create rank system with proper values
COMMENT ON COLUMN user_profiles.rank IS 'Troll Family rank: Tiny Troller, Gang Troller, OG Troller, Old Ass Troller, Dead Troller, Graveyard';

-- Create index for rank queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_rank ON user_profiles(rank);

-- Grant permissions for rank column
GRANT SELECT (rank) ON user_profiles TO anon;
GRANT SELECT (rank) ON user_profiles TO authenticated;
GRANT UPDATE (rank) ON user_profiles TO authenticated;

-- Update existing users with proper ranks (without level dependency)
-- These will be manually assigned by admins or through the family system