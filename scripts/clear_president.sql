-- COMPLETE President Cleanup - Run this to erase president status only (keep other roles)

-- 1. Only clear president badge - don't touch role (it has NOT NULL constraint)
UPDATE user_profiles SET 
  badge = NULL,
  username_style = NULL
WHERE badge = 'president' 
   OR username_style = 'gold';

-- Note: Do NOT set role = NULL as it violates NOT NULL constraint
-- The user will keep their existing role (officer, secretary, etc.)

-- 2. Expire ALL president role grants
UPDATE user_role_grants 
SET expires_at = NOW() 
WHERE expires_at IS NULL OR expires_at > NOW();

-- 3. Clear election winner references (so fallback doesn't find old president)
UPDATE president_elections 
SET winner_candidate_id = NULL 
WHERE status = 'finalized' 
AND winner_candidate_id IS NOT NULL;

-- 4. Clear president appointments
UPDATE president_appointments 
SET status = 'removed', removed_at = NOW() 
WHERE status = 'active';

-- 5. Verify - should return empty for president badge/style
SELECT 'Users with president badge:' as check, COUNT(*) as count FROM user_profiles WHERE badge = 'president'
UNION ALL
SELECT 'Users with gold style:', COUNT(*) FROM user_profiles WHERE username_style = 'gold';