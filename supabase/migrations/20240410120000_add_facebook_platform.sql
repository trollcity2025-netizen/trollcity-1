-- Add Facebook to platform options
-- Run this in Supabase SQL Editor

-- Update connected_social_accounts (use IF EXISTS to avoid errors)
ALTER TABLE connected_social_accounts 
  DROP CONSTRAINT IF EXISTS connected_social_accounts_platform_check,
  ADD CHECK (platform IN ('x', 'instagram', 'facebook'));

-- Update social_publish_queue
ALTER TABLE social_publish_queue 
  DROP CONSTRAINT IF EXISTS social_publish_queue_platform_check,
  ADD CHECK (platform IN ('x', 'instagram', 'facebook'));

-- Only update social_publish_logs if constraint exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'social_publish_logs_platform_check'
  ) THEN
    ALTER TABLE social_publish_logs 
      DROP CONSTRAINT social_publish_logs_platform_check,
      ADD CHECK (platform IN ('x', 'instagram', 'facebook'));
  END IF;
END $$;