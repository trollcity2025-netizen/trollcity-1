-- Comprehensive fix for "integer out of range" errors with large coin balances.

-- 1. Ensure user_profiles columns are BIGINT
-- This might be redundant if 20270801000000_comprehensive_fixes.sql ran, but ensures correctness.
ALTER TABLE public.user_profiles
ALTER COLUMN troll_coins TYPE BIGINT USING troll_coins::BIGINT,
ALTER COLUMN total_earned_coins TYPE BIGINT USING total_earned_coins::BIGINT,
ALTER COLUMN paid_coins TYPE BIGINT USING paid_coins::BIGINT;

-- 2. Ensure coin_transactions amount is BIGINT
ALTER TABLE public.coin_transactions
ALTER COLUMN amount TYPE BIGINT USING amount::BIGINT;

-- 3. Ensure gift costs are BIGINT to prevent any calculation overflows
ALTER TABLE public.gifts
ALTER COLUMN cost TYPE BIGINT USING cost::BIGINT;

ALTER TABLE public.gift_items
ALTER COLUMN value TYPE BIGINT USING value::BIGINT;
