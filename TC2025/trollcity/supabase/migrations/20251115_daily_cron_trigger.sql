-- Create a cron job to run daily at 00:00 UTC to credit paid coins based on level
-- Requires pg_cron extension enabled in Supabase

-- Enable pg_cron (run once per project)
-- CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule daily job
SELECT cron.schedule(
  'daily-level-paid-coins',
  '0 0 * * *', -- daily at 00:00 UTC
  $$SELECT public.credit_daily_paid_coins();$$
);