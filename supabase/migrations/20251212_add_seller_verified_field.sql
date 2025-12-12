-- Add seller_verified field to user_profiles table
-- This tracks whether a user has been approved as a seller

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS seller_verified BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.seller_verified IS 'Indicates if user has been approved as a seller and can create/manage shops';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_seller_verified ON user_profiles(seller_verified) WHERE seller_verified = TRUE;