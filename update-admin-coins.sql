-- Update admin account with 125 million free coins and highest tier
UPDATE user_profiles 
SET 
  free_coin_balance = 125000000,
  level = 100,
  xp = 100000
WHERE id = '8dff9f37-21b5-4b8e-adc2-b9286874be1a';
