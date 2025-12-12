-- Migration: Add active_entrance_effect to user_profiles
-- Created: 2025-12-12
-- Purpose: Add column to track user's active entrance effect

ALTER TABLE user_profiles
ADD COLUMN active_entrance_effect TEXT REFERENCES entrance_effects(id);

-- Add index for performance
CREATE INDEX idx_user_profiles_active_entrance_effect ON user_profiles(active_entrance_effect);

-- Add comment
COMMENT ON COLUMN user_profiles.active_entrance_effect IS 'The entrance effect currently active for this user';