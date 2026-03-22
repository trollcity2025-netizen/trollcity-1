-- Create rtc_sessions table for tracking LiveKit RTC usage
CREATE TABLE IF NOT EXISTS rtc_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rtc_sessions_user_id ON rtc_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_rtc_sessions_room_name ON rtc_sessions(room_name);
CREATE INDEX IF NOT EXISTS idx_rtc_sessions_is_active ON rtc_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_rtc_sessions_started_at ON rtc_sessions(started_at);

-- Enable RLS
ALTER TABLE rtc_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy for admins to manage all sessions
CREATE POLICY "Admins can manage all rtc_sessions" ON rtc_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true)
    )
  );

-- RLS Policy for users to see their own sessions
CREATE POLICY "Users can view own rtc_sessions" ON rtc_sessions
  FOR SELECT
  USING (auth.uid() = user_id);
