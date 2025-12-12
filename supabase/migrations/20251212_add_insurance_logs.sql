-- Migration: Add insurance_logs for audit trail
-- Created: 2025-12-12
-- Purpose: Track insurance usage for fraud prevention

CREATE TABLE insurance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  protection_type TEXT NOT NULL CHECK (protection_type IN ('bankrupt', 'kick', 'full')),
  event_type TEXT NOT NULL, -- 'bankrupt', 'kick', etc.
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_insurance_logs_user ON insurance_logs(user_id);
CREATE INDEX idx_insurance_logs_blocked_at ON insurance_logs(blocked_at);

-- RLS policies
ALTER TABLE insurance_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view insurance logs
CREATE POLICY "Admins can view insurance logs"
  ON insurance_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

-- Users can insert their own logs (for penalty interception)
CREATE POLICY "Users can insert their own insurance logs"
  ON insurance_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE insurance_logs IS 'Audit trail for insurance usage to prevent fraud';
COMMENT ON COLUMN insurance_logs.protection_type IS 'Type of protection that was used';
COMMENT ON COLUMN insurance_logs.event_type IS 'The event that was blocked (bankrupt, kick, etc.)';