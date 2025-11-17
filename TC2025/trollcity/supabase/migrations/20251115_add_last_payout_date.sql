-- Add last_payout_date column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_payout_date TIMESTAMP WITH TIME ZONE;

-- Grant permissions for the new column
GRANT SELECT (last_payout_date) ON profiles TO anon;
GRANT SELECT, UPDATE (last_payout_date) ON profiles TO authenticated;