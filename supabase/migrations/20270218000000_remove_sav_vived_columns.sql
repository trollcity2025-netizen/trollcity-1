-- Remove sav_bonus_coins and vived_bonus_coins columns from user_profiles if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'sav_bonus_coins') THEN
        ALTER TABLE public.user_profiles DROP COLUMN sav_bonus_coins;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'vived_bonus_coins') THEN
        ALTER TABLE public.user_profiles DROP COLUMN vived_bonus_coins;
    END IF;
END $$;
