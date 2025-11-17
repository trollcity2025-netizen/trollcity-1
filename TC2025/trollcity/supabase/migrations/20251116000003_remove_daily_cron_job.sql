-- Remove the daily cron job for level-based paid coins
-- This removes the scheduled job that was crediting daily coins based on user levels

-- Remove the cron job (unschedule it)
SELECT cron.unschedule('daily-level-paid-coins');