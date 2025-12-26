-- Check if troll_coins_balance column exists in user_profiles table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND column_name = 'troll_coins_balance';

-- Also check for free_coin_balance column
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND column_name = 'free_coin_balance';

-- Show all columns in user_profiles table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;