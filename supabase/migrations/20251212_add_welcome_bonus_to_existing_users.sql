-- Add 1000 Tromonds welcome bonus to all existing users
-- This is a one-time migration to give current users the same welcome bonus as new users

-- First, update all existing user profiles to add 1000 free coins
UPDATE user_profiles
SET
  free_coin_balance = COALESCE(free_coin_balance, 0) + 1000,
  total_earned_coins = COALESCE(total_earned_coins, 0) + 1000,
  updated_at = NOW()
WHERE id IS NOT NULL;

-- Then, create transaction records for each user to track this bonus
INSERT INTO coin_transactions (user_id, type, amount, description, created_at)
SELECT
  id as user_id,
  'welcome_bonus' as type,
  1000 as amount,
  'Welcome bonus for existing Troll City users!' as description,
  NOW() as created_at
FROM user_profiles
WHERE id IS NOT NULL;

-- Add a comment to document this migration
COMMENT ON TABLE user_profiles IS 'User profiles with coin balances. All users received a 1000 Tromond welcome bonus on 2025-12-12.';