-- SQL to add OG badge column and set default coins
-- Run this in Supabase SQL Editor

-- Add og_badge column
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS og_badge boolean DEFAULT false;

-- Set default free coins to 200 for new users
ALTER TABLE public.user_profiles 
ALTER COLUMN free_coin_balance SET DEFAULT 200;

-- Give OG badge to users who joined before 2026-01-01
UPDATE public.user_profiles
SET og_badge = true
WHERE created_at < '2026-01-01'::timestamp;

-- Give 200 free coins to existing users with 0
UPDATE public.user_profiles
SET free_coin_balance = 200
WHERE free_coin_balance = 0 OR free_coin_balance IS NULL;

-- Verify
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE og_badge = true) as og_badge_users,
  AVG(free_coin_balance) as avg_free_coins
FROM public.user_profiles;
