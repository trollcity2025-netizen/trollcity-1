-- Verification script for base issues fix
-- Run this in SQL Editor

-- 1. Check RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('gift_ledger', 'battles', 'districts', 'house_upgrades', 'user_house_upgrades', 'auction_bids', 'stream_seat_sessions', 'broadcaster_stats');

-- 2. List Policies
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('gift_ledger', 'battles', 'districts', 'house_upgrades', 'user_house_upgrades', 'auction_bids', 'stream_seat_sessions', 'broadcaster_stats')
ORDER BY tablename, policyname;

-- 3. Check View Security Definer status (should NOT be present for views, but check if it's a standard view)
SELECT table_name, view_definition 
FROM information_schema.views 
WHERE table_schema = 'public' AND table_name = 'broadcaster_stats_public';

-- 4. Check function search paths
-- We can't easily query the SET option directly from standard info schema in a simple way for all, 
-- but we can check a few samples or use pg_proc config
SELECT proname, proconfig 
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace 
AND proname IN ('update_stream_viewer_count', 'send_gift', 'can_start_broadcast')
AND proconfig IS NOT NULL;
