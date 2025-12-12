# Welcome Bonus for Existing Users

This script applies a 1000 Tromonds welcome bonus to all existing users in Troll City.

## Option 1: Run via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the following SQL:

```sql
-- Add 1000 Tromonds welcome bonus to all existing users
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
```

4. Click "Run" to execute the SQL

## Option 2: Run the Script (if environment is set up)

If you have the Supabase environment variables configured:

```bash
node scripts/apply-welcome-bonus.js
```

## What This Does

- **Adds 1000 Tromonds** to each existing user's `free_coin_balance`
- **Updates `total_earned_coins`** to reflect the bonus in earnings tracking
- **Creates transaction records** in `coin_transactions` table for transparency
- **Only affects existing users** - new users get the bonus automatically via ProfileSetupPage.tsx

## Verification

After running, you can verify the bonus was applied by checking:
- User profiles show increased coin balances
- Coin transactions table has new 'welcome_bonus' entries
- Users can see the bonus in their transaction history