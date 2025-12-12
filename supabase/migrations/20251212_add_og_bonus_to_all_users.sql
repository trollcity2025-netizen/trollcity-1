-- Add OG Welcome Bonus to All Users
-- Give 1000 Trollmonds to all current and future users until 2026-01-01

-- 1. Add 1000 Trollmonds to all existing users who don't already have the welcome bonus
INSERT INTO coin_transactions (user_id, type, amount, description, created_at)
SELECT
  up.id,
  'og_welcome_bonus',
  1000,
  'OG Welcome Bonus: 1000 Trollmonds for all users!',
  NOW()
FROM user_profiles up
WHERE up.id NOT IN (
  SELECT ct.user_id
  FROM coin_transactions ct
  WHERE ct.type = 'og_welcome_bonus'
)
ON CONFLICT DO NOTHING;

-- 2. Update user balances to add 1000 Trollmonds
UPDATE user_profiles
SET
  free_coin_balance = free_coin_balance + 1000,
  total_earned_coins = total_earned_coins + 1000,
  updated_at = NOW()
WHERE id NOT IN (
  SELECT ct.user_id
  FROM coin_transactions ct
  WHERE ct.type = 'og_welcome_bonus'
);

-- 3. Create function to automatically grant OG welcome bonus to new users
CREATE OR REPLACE FUNCTION grant_og_welcome_bonus()
RETURNS TRIGGER AS $$
BEGIN
  -- Only grant bonus until 2026-01-01
  IF CURRENT_DATE < '2026-01-01' THEN
    -- Add 1000 Trollmonds to new user
    NEW.free_coin_balance = COALESCE(NEW.free_coin_balance, 0) + 1000;
    NEW.total_earned_coins = COALESCE(NEW.total_earned_coins, 0) + 1000;

    -- Record the transaction (will be done after insert due to trigger timing)
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger for new users
DROP TRIGGER IF EXISTS tr_grant_og_welcome_bonus ON user_profiles;
CREATE TRIGGER tr_grant_og_welcome_bonus
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION grant_og_welcome_bonus();

-- 5. For new users, also create the transaction record after insert
CREATE OR REPLACE FUNCTION record_og_welcome_bonus()
RETURNS TRIGGER AS $$
BEGIN
  -- Only record bonus until 2026-01-01
  IF CURRENT_DATE < '2026-01-01' THEN
    INSERT INTO coin_transactions (user_id, type, amount, description, created_at)
    VALUES (NEW.id, 'og_welcome_bonus', 1000, 'OG Welcome Bonus: 1000 Trollmonds for all users!', NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create after-insert trigger for transaction recording
DROP TRIGGER IF EXISTS tr_record_og_welcome_bonus ON user_profiles;
CREATE TRIGGER tr_record_og_welcome_bonus
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION record_og_welcome_bonus();

-- 7. Verification query
SELECT
  'OG Welcome Bonus Applied' as status,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE og_badge = true) as og_badge_users,
  AVG(free_coin_balance) as avg_trollmonds,
  SUM(CASE WHEN free_coin_balance >= 1000 THEN 1 ELSE 0 END) as users_with_bonus
FROM user_profiles;