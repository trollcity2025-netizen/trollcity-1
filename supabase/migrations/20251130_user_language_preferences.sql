-- User Language Preferences
-- Allows users to set their preferred language for translations

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en';

-- Add comment
COMMENT ON COLUMN user_profiles.preferred_language IS 'User preferred language code (en, es, ar, fr, fil, etc.) for translations';

