-- Create kicked_users table for admin kick functionality
CREATE TABLE IF NOT EXISTS kicked_users (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT DEFAULT 'Admin kick - payment required',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_kicked_users_user_id ON kicked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_kicked_users_created_at ON kicked_users(created_at);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON kicked_users TO authenticated;
GRANT SELECT ON kicked_users TO anon;
GRANT USAGE ON SEQUENCE kicked_users_id_seq TO authenticated;