-- Remove coins per day per level system
-- This migration removes the daily paid coins feature based on user levels

-- Remove the daily paid coins function
DROP FUNCTION IF EXISTS public.credit_daily_paid_coins();

-- Remove the level computation function
DROP FUNCTION IF EXISTS public.compute_user_level(INTEGER);

-- Remove daily paid coins tracking columns
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS last_daily_paid_coins,
DROP COLUMN IF EXISTS level;

-- Remove any daily level bonus transactions that were created
DELETE FROM public.coin_transactions 
WHERE type = 'credit' 
AND reason = 'daily_level_bonus';