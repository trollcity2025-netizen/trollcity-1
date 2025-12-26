-- Add missing troll_coins_balance column to user_profiles table
DO $$
BEGIN
  -- Add troll_coins_balance column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'troll_coins_balance') THEN
    ALTER TABLE user_profiles ADD COLUMN troll_coins_balance INTEGER DEFAULT 0 CHECK (troll_coins_balance >= 0);
    RAISE NOTICE 'Added troll_coins_balance column to user_profiles';
  ELSE
    RAISE NOTICE 'troll_coins_balance column already exists';
  END IF;
  
  -- Also ensure free_coin_balance exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'free_coin_balance') THEN
    ALTER TABLE user_profiles ADD COLUMN free_coin_balance INTEGER DEFAULT 0 CHECK (free_coin_balance >= 0);
    RAISE NOTICE 'Added free_coin_balance column to user_profiles';
  ELSE
    RAISE NOTICE 'free_coin_balance column already exists';
  END IF;
END $$;