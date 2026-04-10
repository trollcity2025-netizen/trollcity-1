-- Add Facebook to platform options
-- Run this in Supabase SQL Editor

-- Update connected_social_accounts
ALTER TABLE connected_social_accounts 
  DROP CONSTRAINT connected_social_accounts_platform_check,
  ADD CHECK (platform IN ('x', 'instagram', 'facebook'));

-- Update social_publish_queue
ALTER TABLE social_publish_queue 
  DROP CONSTRAINT social_publish_queue_platform_check,
  ADD CHECK (platform IN ('x', 'instagram', 'facebook'));

-- Update social_publish_logs
ALTER TABLE social_publish_logs 
  DROP CONSTRAINT social_publish_logs_platform_check,
  ADD CHECK (platform IN ('x', 'instagram', 'facebook'));