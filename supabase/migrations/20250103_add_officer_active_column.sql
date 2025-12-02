-- Add is_officer_active column to user_profiles
-- This column tracks whether an officer has completed orientation and is active

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_officer_active BOOLEAN DEFAULT false;

-- Update existing officers to be active if they already have is_troll_officer = true
UPDATE user_profiles
SET is_officer_active = true
WHERE is_troll_officer = true AND is_officer_active IS NULL;

COMMENT ON COLUMN user_profiles.is_officer_active IS 'Indicates if officer has completed orientation and is active';

