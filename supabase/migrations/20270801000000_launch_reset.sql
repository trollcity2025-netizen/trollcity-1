-- Launch Reset SQL
-- Wipes all data except user identities/roles
-- Resets user balances to 750 coins

BEGIN;

-- 1. Pre-reset: Clear references in user_profiles to prevent FK violations when truncating other tables
-- We set to NULL any column that might reference a table we are about to truncate.
UPDATE public.user_profiles
SET
    active_vehicle = NULL,
    vehicle_image = NULL,
    badge = NULL,
    glowing_username_color = NULL,
    username_style = NULL,
    payout_details = NULL;

-- 2. Truncate all tables in public schema EXCEPT user_profiles
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename != 'user_profiles'
          AND tablename != 'spatial_ref_sys' -- Exclude PostGIS system table
    ) LOOP
        -- RAISE NOTICE 'Truncating %', r.tablename;
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE;';
    END LOOP;
END $$;

-- 3. Reset User State in user_profiles
UPDATE public.user_profiles
SET
    -- Economy (Final instruction: 750 coins)
    troll_coins = 750,
    paid_coins = 0,
    reserved_troll_coins = 0,
    total_earned_coins = 0,
    total_spent_coins = 0,
    
    -- XP / Progression
    xp = 0,
    level = 1,
    total_xp = 0,
    -- next_level_xp = 100, -- REMOVED: Column does not exist
    -- prestige_level = 0, -- REMOVED: Column does not exist
    
    -- Inventory / Perks
    has_insurance = false,
    insurance_level = NULL,
    insurance_expires_at = NULL,
    rgb_username_expires_at = NULL,
    glowing_username_color = NULL,
    username_style = NULL,
    is_gold = false,
    perk_tokens = 0,
    multiplier_active = false,
    multiplier_value = 1,
    multiplier_expires = NULL,
    
    -- Status / Punishments
    no_kick_until = NULL,
    no_ban_until = NULL,
    mic_muted_until = NULL,
    live_restricted_until = NULL,
    ban_expires_at = NULL,
    has_active_warrant = false,
    is_banned = false,
    is_kicked = false,
    kicked_until = NULL,
    kick_count = 0,
    
    -- Officer / Job Stats
    owc_balance = 0,
    total_owc_earned = 0,
    officer_reputation_score = 0,
    
    -- TMV
    gas_balance = 0,
    last_gas_update = NOW(),
    drivers_license_status = 'none',
    drivers_license_expiry = NULL,
    
    -- Credit
    credit_used = 0,
    credit_status = 'active',
    
    -- Verification / Other
    verification_paid_amount = 0,
    is_trolls_night_approved = false,
    trolls_night_rejection_count = 0,
    
    updated_at = NOW();

-- 4. Verification
DO $$
DECLARE
    profile_count INT;
    non_750_count INT;
    other_table_count INT;
BEGIN
    -- Verify balances
    SELECT COUNT(*) INTO non_750_count FROM public.user_profiles WHERE troll_coins != 750;
    IF non_750_count > 0 THEN
        RAISE EXCEPTION 'Verification Failed: % users do not have 750 coins', non_750_count;
    END IF;

    -- Verify roles are intact (simple check that profiles still exist)
    SELECT COUNT(*) INTO profile_count FROM public.user_profiles;
    IF profile_count = 0 THEN
        RAISE WARNING 'Warning: No user profiles found. Was the table empty?';
    END IF;
    
    -- Verify other tables are empty (Sample check on a known table like coin_transactions if it exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coin_transactions') THEN
        EXECUTE 'SELECT COUNT(*) FROM public.coin_transactions' INTO other_table_count;
        IF other_table_count > 0 THEN
             RAISE EXCEPTION 'Verification Failed: coin_transactions table is not empty';
        END IF;
    END IF;
    
END $$;

COMMIT;
