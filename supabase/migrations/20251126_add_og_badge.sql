-- OG Badge System Migration
-- Adds OG badge column and auto-grant trigger for early users

-- 1. Add og_badge column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'og_badge'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN og_badge BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 2. Create trigger to auto-grant OG badge to users created before 2026-01-01
CREATE OR REPLACE FUNCTION grant_og_badge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_at < '2026-01-01' THEN
    NEW.og_badge = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger
CREATE TRIGGER tr_grant_og_badge
BEFORE INSERT OR UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION grant_og_badge();

-- 4. Update existing users who joined before 2026-01-01
UPDATE user_profiles
SET og_badge = true
WHERE created_at < '2026-01-01'
AND og_badge = false;

-- 5. Add index for OG badge for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_og_badge ON user_profiles(og_badge);
