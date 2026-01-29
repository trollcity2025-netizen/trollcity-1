-- Launch Day Reset Migration
-- This script resets all user data for a fresh launch
-- DO NOT run this on a production database unless you want to wipe all user progress!

-- =====================================================
-- STEP 1: Reset user coins to 750 for all users
-- =====================================================
-- Update profiles table - reset coin_balance to 750
UPDATE public.profiles
SET troll_coins = 750
WHERE troll_coins != 750;

-- Update user_profiles table - reset coin_balance to 750
UPDATE public.user_profiles
SET coin_balance = 750,
    free_coin_balance = 0,
    paid_coins = 0,
    bonus_coin_balance = 0,
    troll_coins = 750,
    total_earned_coins = 0,
    total_spent_coins = 0,
    total_coins_earned = 0,
    total_coins_spent = 0,
    owc_balance = 0,
    total_owc_earned = 0;

-- =====================================================
-- STEP 2: Remove all user cars
-- =====================================================
DELETE FROM public.user_cars;

-- Reset any sequences if needed
-- (Sequences auto-regenerate on next insert, so no action needed)

-- =====================================================
-- STEP 3: Remove all user properties/houses
-- =====================================================
-- First remove property upgrades
DELETE FROM public.property_upgrades
WHERE property_id IN (SELECT id FROM public.properties WHERE owner_user_id IS NOT NULL);

-- Reset property ownership (keep the properties but clear ownership)
UPDATE public.properties
SET owner_id = NULL,
    owner_user_id = NULL,
    is_listed = true,
    is_active_home = false,
    upgrade_spend_total = 0;

-- =====================================================
-- STEP 4: Remove all transaction histories
-- =====================================================
DELETE FROM public.coin_transactions;
DELETE FROM public.transactions;
DELETE FROM public.shop_transactions;
DELETE FROM public.gift_transactions;
DELETE FROM public.payment_transactions;
DELETE FROM public.punishment_transactions;
DELETE FROM public.call_transactions;
DELETE FROM public.declined_transactions;
DELETE FROM public.verification_transactions;
DELETE FROM public.admin_pool_transactions;
DELETE FROM public.wallet_transactions;
DELETE FROM public.paypal_transactions;
DELETE FROM public.promo_code_uses;
DELETE FROM public.trollmond_transactions;
DELETE FROM public.trollmond_ledger;

-- =====================================================
-- STEP 5: Remove all troll wall posts and reactions
-- =====================================================
DELETE FROM public.troll_wall_reactions;
DELETE FROM public.troll_wall_posts;

-- Also clear wall_posts table
DELETE FROM public.wall_posts;

-- =====================================================
-- STEP 6: Add posts column to user_profiles if missing
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles'
        AND column_name = 'posts'
    ) THEN
        ALTER TABLE public.user_profiles
        ADD COLUMN posts JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- =====================================================
-- STEP 7: Reset other game-related data
-- =====================================================
-- Reset daily login bonuses tracking
-- (This depends on your specific implementation - leaving as comment for manual review)

-- Reset starter vehicles/grants tracking
-- (This depends on your specific implementation - leaving as comment for manual review)

-- =====================================================
-- VERIFICATION QUERIES (for manual verification after running)
-- =====================================================
-- SELECT 'profiles troll_coins reset:' AS action, COUNT(*) AS count FROM public.profiles WHERE troll_coins = 750;
-- SELECT 'user_profiles coin_balance reset:' AS action, COUNT(*) AS count FROM public.user_profiles WHERE coin_balance = 750;
-- SELECT 'user_cars cleared:' AS action, COUNT(*) AS count FROM public.user_cars;
-- SELECT 'properties ownership cleared:' AS action, COUNT(*) AS count FROM public.properties WHERE owner_user_id IS NULL;
-- SELECT 'coin_transactions cleared:' AS action, COUNT(*) AS count FROM public.coin_transactions;
-- SELECT 'troll_wall_posts cleared:' AS action, COUNT(*) AS count FROM public.troll_wall_posts;
