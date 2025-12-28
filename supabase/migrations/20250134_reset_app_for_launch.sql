-- RESET ENTIRE APP FOR LAUNCH
-- This removes all test transactions, payouts, and admin testing data
-- Run this in Supabase SQL Editor before launching

-- 1. Delete all coin transactions (except keep structure)
TRUNCATE TABLE coin_transactions CASCADE;

-- 2. Delete all payout requests
TRUNCATE TABLE payout_requests CASCADE;

-- 3. Reset all user coin balances to 0
UPDATE user_profiles
SET 
  paid_coin_balance = 0,
  free_coin_balance = 0,
  total_coins_earned = 0,
  total_coins_spent = 0
WHERE paid_coin_balance > 0 OR free_coin_balance > 0 OR total_coins_earned > 0 OR total_coins_spent > 0;

-- 4. Delete all test messages (optional - you may want to keep real user messages)
-- Uncomment if you want to clear all messages:
-- TRUNCATE TABLE messages CASCADE;

-- 5. Delete all test notifications
TRUNCATE TABLE notifications CASCADE;

-- 6. Delete all test streams (optional - keep if you want to preserve stream history)
-- Uncomment if you want to clear all streams:
-- TRUNCATE TABLE streams CASCADE;

-- 7. Delete all test gifts
TRUNCATE TABLE gifts CASCADE;

-- 8. Delete all test battles
TRUNCATE TABLE battle_history CASCADE;
TRUNCATE TABLE battles CASCADE;

-- 9. Delete all test referrals (optional - keep if you want to preserve referral data)
-- Uncomment if you want to clear all referrals:
-- TRUNCATE TABLE referrals CASCADE;
-- TRUNCATE TABLE referral_monthly_bonus CASCADE;

-- 10. Delete all test applications (optional - keep if you want to preserve application history)
-- Uncomment if you want to clear all applications:
-- TRUNCATE TABLE applications CASCADE;
-- TRUNCATE TABLE broadcaster_applications CASCADE;
-- TRUNCATE TABLE empire_applications CASCADE;

-- 11. Delete all test support tickets
TRUNCATE TABLE support_tickets CASCADE;

-- 12. Delete all test officer shift logs
TRUNCATE TABLE officer_shift_logs CASCADE;
TRUNCATE TABLE officer_shift_slots CASCADE;

-- 13. Delete all test officer actions
TRUNCATE TABLE officer_actions CASCADE;

-- 14. Delete all test quiz results (optional - keep if you want to preserve quiz history)
-- Uncomment if you want to clear all quiz results:
-- TRUNCATE TABLE officer_orientation_results CASCADE;
-- TRUNCATE TABLE officer_quiz_submissions CASCADE;
-- TRUNCATE TABLE quiz_answers CASCADE;

-- 15. Reset admin user balances (keep admin account but reset coins)
UPDATE user_profiles
SET 
  paid_coin_balance = 0,
  free_coin_balance = 0,
  total_coins_earned = 0,
  total_coins_spent = 0
WHERE role = 'admin' OR email = 'trollcity2025@gmail.com';

-- 16. Log the reset
INSERT INTO system_logs (event_type, description, metadata, created_at)
VALUES (
  'app_reset',
  'Application reset for launch - all test data cleared',
  jsonb_build_object(
    'reset_at', NOW(),
    'reset_by', 'admin',
    'reset_reason', 'pre_launch_cleanup'
  ),
  NOW()
);

-- Verify counts (for confirmation)
SELECT 
  'coin_transactions' as table_name, COUNT(*) as count FROM coin_transactions
UNION ALL
SELECT 'payout_requests', COUNT(*) FROM payout_requests
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'gifts', COUNT(*) FROM gifts
UNION ALL
SELECT 'battle_history', COUNT(*) FROM battle_history
UNION ALL
SELECT 'officer_shift_logs', COUNT(*) FROM officer_shift_logs;

