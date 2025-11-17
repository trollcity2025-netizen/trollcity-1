-- Add missing columns to kicked_users table if they don't exist
ALTER TABLE kicked_users 
ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT 'Kicked by admin',
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours';