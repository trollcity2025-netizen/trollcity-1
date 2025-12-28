-- Set admin coin amounts to infinity (high number)
UPDATE user_profiles
SET free_coin_balance = 999999999,
    total_earned_coins = 999999999
WHERE role = 'admin';

-- Also set level to 101 for admin (assuming user_levels table exists)
-- First ensure user_levels entry exists
INSERT INTO user_levels (user_id, level, xp, total_xp, next_level_xp)
SELECT id, 101, 999999, 999999, 999999
FROM user_profiles
WHERE role = 'admin'
ON CONFLICT (user_id) DO UPDATE SET
  level = 101,
  xp = 999999,
  total_xp = 999999,
  next_level_xp = 999999;