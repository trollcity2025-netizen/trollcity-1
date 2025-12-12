-- Make all users broadcasters to remove application requirements
UPDATE user_profiles
SET
  is_broadcaster = true,
  updated_at = NOW()
WHERE is_broadcaster = false OR is_broadcaster IS NULL;

-- Verify the update
SELECT
  COUNT(*) as total_users,
  COUNT(CASE WHEN is_broadcaster = true THEN 1 END) as broadcasters
FROM user_profiles;