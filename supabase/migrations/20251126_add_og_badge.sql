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

-- 2. Create trigger to auto-grant OG badge to ALL users until 2026-01-01
CREATE OR REPLACE FUNCTION grant_og_badge()
RETURNS TRIGGER AS $$
BEGIN
  -- Grant OG badge to all users until 2026-01-01
  IF CURRENT_DATE < '2026-01-01' THEN
    NEW.og_badge = true;
  ELSE
    -- After 2026-01-01, only grant to early users (created before 2026-01-01)
    IF NEW.created_at < '2026-01-01' THEN
      NEW.og_badge = true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger
CREATE TRIGGER tr_grant_og_badge
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION grant_og_badge();

-- 4. Update ALL existing users to get OG badge until 2026-01-01
UPDATE user_profiles
SET og_badge = true
WHERE CURRENT_DATE < '2026-01-01';

-- 5. Add index for OG badge for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_og_badge ON user_profiles(og_badge);
