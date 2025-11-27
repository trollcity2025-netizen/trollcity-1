-- Populate usernames for all existing users who don't have one
-- This will extract the username from their email address (part before @)

-- Update all users with NULL or empty username to use their email prefix
UPDATE public.user_profiles
SET 
  username = SPLIT_PART(auth.users.email, '@', 1),
  updated_at = NOW()
FROM auth.users
WHERE 
  user_profiles.id = auth.users.id
  AND (user_profiles.username IS NULL OR user_profiles.username = '' OR TRIM(user_profiles.username) = '');

-- Log the number of affected rows
DO $block$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Updated % user profiles with usernames from email', affected_count;
END $block$;
