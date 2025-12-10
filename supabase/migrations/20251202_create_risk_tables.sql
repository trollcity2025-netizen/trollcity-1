-- Risk Management Tables Migration
-- Creates tables for user risk profiling and event tracking

-- 1. Create user_risk_profile table
CREATE TABLE IF NOT EXISTS user_risk_profile (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id),
  risk_score INTEGER DEFAULT 0,
  is_frozen BOOLEAN DEFAULT false,
  freeze_reason TEXT,
  last_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create risk_events table
CREATE TABLE IF NOT EXISTS risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  event_type TEXT NOT NULL,
  severity INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_risk_profile_risk_score ON user_risk_profile(risk_score);
CREATE INDEX IF NOT EXISTS idx_user_risk_profile_is_frozen ON user_risk_profile(is_frozen);
CREATE INDEX IF NOT EXISTS idx_risk_events_user_id ON risk_events(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_created_at ON risk_events(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_events_severity ON risk_events(severity);

-- 4. Create RLS policies
ALTER TABLE user_risk_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own risk profile
CREATE POLICY "Users can view their own risk profile"
  ON user_risk_profile FOR SELECT
  USING (user_id = auth.uid());

-- Officers and admins can view all risk profiles
CREATE POLICY "Officers can view all risk profiles"
  ON user_risk_profile FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_officer = true OR role = 'admin' OR is_admin = true)
    )
  );

-- Officers and admins can manage risk profiles
CREATE POLICY "Officers can manage risk profiles"
  ON user_risk_profile FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_officer = true OR role = 'admin' OR is_admin = true)
    )
  );

-- Users can view their own risk events
CREATE POLICY "Users can view their own risk events"
  ON risk_events FOR SELECT
  USING (user_id = auth.uid());

-- Officers and admins can view all risk events
CREATE POLICY "Officers can view all risk events"
  ON risk_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_officer = true OR role = 'admin' OR is_admin = true)
    )
  );

-- Officers and admins can create risk events
CREATE POLICY "Officers can create risk events"
  ON risk_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_officer = true OR role = 'admin' OR is_admin = true)
    )
  );