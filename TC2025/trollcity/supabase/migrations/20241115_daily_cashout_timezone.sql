-- Create function to process daily cashouts at 2pm for all users timezone
-- This function will be called by a cron job

-- Create function to process daily cashouts
CREATE OR REPLACE FUNCTION process_daily_cashouts()
RETURNS void AS $$
BEGIN
  -- Process cashouts for users whose local time is 2pm
  -- This assumes we have timezone data in user profiles
  INSERT INTO cashout_requests (user_id, amount, status, created_at)
  SELECT 
    p.id as user_id,
    CASE 
      WHEN p.level >= 71 THEN 500  -- Graveyard
      WHEN p.level >= 61 THEN 200  -- Dead troller
      WHEN p.level >= 41 THEN 175  -- Old Ass troller
      WHEN p.level >= 20 THEN 100  -- OG Troller
      WHEN p.level >= 10 THEN 55   -- Gang Troller
      ELSE 25  -- Tiny Troller
    END as amount,
    'pending' as status,
    NOW() as created_at
  FROM profiles p
  WHERE (
    -- Check if it's 2pm in user's timezone (or default to UTC if no timezone set)
    EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(p.timezone, 'UTC')) = 14
    OR (
      -- Fallback: if no timezone, check if it's 2pm UTC
      p.timezone IS NULL 
      AND EXTRACT(HOUR FROM NOW()) = 14
    )
  )
  AND p.is_active = true
  AND p.is_banned != true
  AND (
    -- Ensure user hasn't already received a cashout today
    NOT EXISTS (
      SELECT 1 FROM cashout_requests cr 
      WHERE cr.user_id = p.id 
      AND cr.created_at >= DATE_TRUNC('day', NOW())
      AND cr.status IN ('pending', 'approved', 'paid')
    )
  )
  AND (
    -- Ensure user has been active in the last 7 days
    p.last_active_at >= NOW() - INTERVAL '7 days'
    OR p.created_at >= NOW() - INTERVAL '7 days'
  );

  -- Log the cashout processing
  INSERT INTO admin_logs (action_type, performed_by, details, created_at)
  VALUES (
    'daily_cashout_processing',
    'system',
    jsonb_build_object(
      'processed_at', NOW(),
      'processed_count', (SELECT COUNT(*) FROM cashout_requests WHERE created_at >= DATE_TRUNC('day', NOW())),
      'hour_processed', EXTRACT(HOUR FROM NOW())
    ),
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to process cashouts for specific timezone
CREATE OR REPLACE FUNCTION process_cashouts_for_timezone(target_timezone text)
RETURNS void AS $$
BEGIN
  INSERT INTO cashout_requests (user_id, amount, status, created_at)
  SELECT 
    p.id as user_id,
    CASE 
      WHEN p.level >= 71 THEN 500  -- Graveyard
      WHEN p.level >= 61 THEN 200  -- Dead troller
      WHEN p.level >= 41 THEN 175  -- Old Ass troller
      WHEN p.level >= 20 THEN 100  -- OG Troller
      WHEN p.level >= 10 THEN 55   -- Gang Troller
      ELSE 25  -- Tiny Troller
    END as amount,
    'pending' as status,
    NOW() as created_at
  FROM profiles p
  WHERE (
    -- Check if it's 2pm in the target timezone
    EXTRACT(HOUR FROM NOW() AT TIME ZONE target_timezone) = 14
    AND (
      p.timezone = target_timezone
      OR (
        p.timezone IS NULL 
        AND target_timezone = 'UTC'
      )
    )
  )
  AND p.is_active = true
  AND p.is_banned != true
  AND (
    -- Ensure user hasn't already received a cashout today
    NOT EXISTS (
      SELECT 1 FROM cashout_requests cr 
      WHERE cr.user_id = p.id 
      AND cr.created_at >= DATE_TRUNC('day', NOW())
      AND cr.status IN ('pending', 'approved', 'paid')
    )
  )
  AND (
    -- Ensure user has been active in the last 7 days
    p.last_active_at >= NOW() - INTERVAL '7 days'
    OR p.created_at >= NOW() - INTERVAL '7 days'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add timezone column to profiles if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for efficient timezone-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_timezone ON profiles(timezone);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active_at);

-- Create admin logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for admin logs
CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON admin_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);

-- Schedule cron jobs for major timezones
-- This will run every hour and check if it's 2pm in each timezone
SELECT cron.schedule(
  'daily-cashout-utc',
  '0 14 * * *', -- Daily at 14:00 UTC
  $$SELECT public.process_cashouts_for_timezone('UTC');$$
);

SELECT cron.schedule(
  'daily-cashout-est',
  '0 19 * * *', -- Daily at 19:00 UTC (2pm EST)
  $$SELECT public.process_cashouts_for_timezone('America/New_York');$$
);

SELECT cron.schedule(
  'daily-cashout-pst',
  '0 22 * * *', -- Daily at 22:00 UTC (2pm PST)
  $$SELECT public.process_cashouts_for_timezone('America/Los_Angeles');$$
);

SELECT cron.schedule(
  'daily-cashout-cet',
  '0 13 * * *', -- Daily at 13:00 UTC (2pm CET)
  $$SELECT public.process_cashouts_for_timezone('Europe/Paris');$$
);

SELECT cron.schedule(
  'daily-cashout-aest',
  '0 4 * * *', -- Daily at 04:00 UTC (2pm AEST next day)
  $$SELECT public.process_cashouts_for_timezone('Australia/Sydney');$$
);

-- Grant permissions
GRANT SELECT ON admin_logs TO authenticated;
GRANT EXECUTE ON FUNCTION process_daily_cashouts() TO authenticated;
GRANT EXECUTE ON FUNCTION process_cashouts_for_timezone(text) TO authenticated;