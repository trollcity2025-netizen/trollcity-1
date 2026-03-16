-- Add wheel_troll_locked_until column to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS wheel_troll_locked_until TIMESTAMPTZ DEFAULT NULL;

-- Add wheel_balance column to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS wheel_balance INTEGER DEFAULT 0;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_wheel_troll_locked 
ON user_profiles (wheel_troll_locked_until) 
WHERE wheel_troll_locked_until IS NOT NULL;

-- Grant permissions
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO anon;
