SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('user_profiles', 'user_balances') 
AND column_name IN ('troll_coins', 'free_coin_balance', 'earned_coin_balance', 'paid_coin_balance', 'total_earned_coins', 'trollmonds', 'total_trollmonds');
