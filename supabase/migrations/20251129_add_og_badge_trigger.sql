-- Add is_og_user field to user_profiles table
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_og_user BOOLEAN DEFAULT false;

-- Create function to auto-assign OG badge based on join date
CREATE OR REPLACE FUNCTION set_og_badge()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Auto-mark users who joined before 2026-01-01 as OG
  IF (NEW.created_at < '2026-01-01'::timestamp) THEN
    NEW.is_og_user := true;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to execute on user_profiles insert
DROP TRIGGER IF EXISTS assign_og_on_register ON user_profiles;
CREATE TRIGGER assign_og_on_register
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_og_badge();

-- Backfill: Mark existing users who joined before 2026-01-01 as OG
UPDATE user_profiles
SET is_og_user = true
WHERE created_at < '2026-01-01'::timestamp
  AND is_og_user = false;

-- Create index for OG user queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_og ON user_profiles(is_og_user) WHERE is_og_user = true;

-- Add comment
COMMENT ON COLUMN user_profiles.is_og_user IS 'OG status - automatically assigned based on join date (before 2026-01-01). Immutable and permanent.';

