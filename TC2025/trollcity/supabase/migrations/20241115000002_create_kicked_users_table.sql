-- Create kicked_users table for admin kick functionality
CREATE TABLE IF NOT EXISTS kicked_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kicked_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT DEFAULT 'Kicked by admin',
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- Grant permissions
GRANT SELECT ON kicked_users TO anon;
GRANT ALL PRIVILEGES ON kicked_users TO authenticated;

-- Create index for efficient lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_kicked_users_user_id ON kicked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_kicked_users_expires_at ON kicked_users(expires_at);