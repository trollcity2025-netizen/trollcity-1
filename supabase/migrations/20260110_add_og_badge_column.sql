-- Migration: Add OG badge column to user_profiles and set for all users until 2-1-2026

-- 1. Add is_og_user column if it doesn't exist
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_og_user BOOLEAN DEFAULT false;

-- 2. Create a function to check if OG period is active
CREATE OR REPLACE FUNCTION is_og_period_active()
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT NOW() < '2026-02-01 00:00:00'::timestamptz;
$$;

-- 3. Create a trigger function to set OG status for new users
CREATE OR REPLACE FUNCTION set_og_status_for_new_users()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF is_og_period_active() THEN
    NEW.is_og_user = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Create trigger to automatically set OG status for new users
DROP TRIGGER IF EXISTS trg_set_og_status ON user_profiles;
CREATE TRIGGER trg_set_og_status
BEFORE INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION set_og_status_for_new_users();

-- 5. Update all existing users to have OG status if period is active
DO $$
BEGIN
  IF is_og_period_active() THEN
    UPDATE user_profiles
    SET is_og_user = TRUE
    WHERE is_og_user = FALSE;
    
    RAISE NOTICE 'OG period is active. All users have been granted OG status.';
  ELSE
    RAISE NOTICE 'OG period has ended. No users were updated.';
  END IF;
END $$;

-- 6. Create a scheduled function to remove OG status after the period ends
CREATE OR REPLACE FUNCTION remove_og_status_after_period()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- This function will be called by a scheduled job after 2-1-2026
  -- to remove OG status from users who don't have permanent OG status
  
  -- For now, we'll just log that the period has ended
  IF NOT is_og_period_active() THEN
    RAISE NOTICE 'OG period has ended. Consider running a cleanup to remove temporary OG status.';
  END IF;
END;
$$;