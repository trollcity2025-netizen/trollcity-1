-- Fix missing columns for notifications and profiles

-- Add is_read column to notifications table if it doesn't exist
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Add follower_count column to profiles table if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;

-- Add status column to profiles table if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Grant permissions for the new columns
GRANT SELECT ON notifications TO anon, authenticated;
GRANT UPDATE ON notifications TO authenticated;
GRANT SELECT ON profiles TO anon, authenticated;
GRANT UPDATE ON profiles TO authenticated;