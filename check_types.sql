SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('user_profiles', 'coin_transactions') 
AND column_name IN ('troll_coins', 'amount');
