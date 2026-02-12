-- Bug Alerts System
-- Real-time bug reporting and admin notification system

-- Create enum types for bug alert severity and status
DO $$ BEGIN
  CREATE TYPE bug_alert_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE bug_alert_category AS ENUM ('livekit', 'broadcast', 'auth', 'database', 'payment', 'chat', 'ui', 'performance', 'security', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE bug_alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'dismissed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create bug_alerts table
CREATE TABLE IF NOT EXISTS bug_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Core fields
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity bug_alert_severity DEFAULT 'medium',
  category bug_alert_category DEFAULT 'other',
  status bug_alert_status DEFAULT 'active',
  
  -- Reporter info
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_by_username TEXT,
  
  -- Affected entities
  affected_users TEXT[] DEFAULT '{}',
  affected_components TEXT[] DEFAULT '{}',
  
  -- Error details
  error_message TEXT,
  stack_trace TEXT,
  user_agent TEXT,
  page_url TEXT,
  
  -- Additional metadata (JSON for flexibility)
  metadata JSONB DEFAULT '{}',
  
  -- Resolution tracking
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  admin_notes TEXT
);

-- Enable Row Level Security
ALTER TABLE bug_alerts ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bug_alerts_status ON bug_alerts(status);
CREATE INDEX IF NOT EXISTS idx_bug_alerts_severity ON bug_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_bug_alerts_category ON bug_alerts(category);
CREATE INDEX IF NOT EXISTS idx_bug_alerts_created_at ON bug_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_alerts_reported_by ON bug_alerts(reported_by);
CREATE INDEX IF NOT EXISTS idx_bug_alerts_status_severity ON bug_alerts(status, severity);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_bug_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bug_alerts_updated_at ON bug_alerts;
CREATE TRIGGER trigger_bug_alerts_updated_at
  BEFORE UPDATE ON bug_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_bug_alerts_updated_at();

-- RLS Policies

-- Admins can do everything
DROP POLICY IF EXISTS "Admins can manage all bug alerts" ON bug_alerts;
CREATE POLICY "Admins can manage all bug alerts"
  ON bug_alerts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Any authenticated user can create bug alerts
DROP POLICY IF EXISTS "Authenticated users can create bug alerts" ON bug_alerts;
CREATE POLICY "Authenticated users can create bug alerts"
  ON bug_alerts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Admins can view all bug alerts
DROP POLICY IF EXISTS "Admins can view all bug alerts" ON bug_alerts;
CREATE POLICY "Admins can view all bug alerts"
  ON bug_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Enable Realtime for bug_alerts
-- Check if publication exists and if table is already in it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'bug_alerts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE bug_alerts;
    END IF;
END $$;

-- Create a function to report bugs (simple insert wrapper)
CREATE OR REPLACE FUNCTION report_bug(
  p_title TEXT,
  p_description TEXT,
  p_severity bug_alert_severity DEFAULT 'medium',
  p_category bug_alert_category DEFAULT 'other',
  p_error_message TEXT DEFAULT NULL,
  p_stack_trace TEXT DEFAULT NULL,
  p_affected_components TEXT[] DEFAULT '{}'
)
RETURNS bug_alerts AS $$
DECLARE
  v_current_user UUID;
  v_username TEXT;
  v_result bug_alerts;
BEGIN
  -- Get current user info
  SELECT auth.uid() INTO v_current_user;
  
  SELECT username INTO v_username 
  FROM profiles 
  WHERE id = v_current_user;
  
  INSERT INTO bug_alerts (
    title,
    description,
    severity,
    category,
    error_message,
    stack_trace,
    affected_components,
    reported_by,
    reported_by_username,
    user_agent,
    page_url
  ) VALUES (
    p_title,
    p_description,
    p_severity,
    p_category,
    p_error_message,
    p_stack_trace,
    p_affected_components,
    v_current_user,
    v_username,
    NULL, -- Will be set client-side
    NULL  -- Will be set client-side
  )
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on table and columns
COMMENT ON TABLE bug_alerts IS 'Bug alerts for real-time admin notifications';
COMMENT ON COLUMN bug_alerts.title IS 'Brief title summarizing the bug';
COMMENT ON COLUMN bug_alerts.description IS 'Detailed description of the bug';
COMMENT ON COLUMN bug_alerts.severity IS 'Bug severity level: critical, high, medium, low, info';
COMMENT ON COLUMN bug_alerts.category IS 'Bug category: livekit, broadcast, auth, database, payment, chat, ui, performance, security, other';
COMMENT ON COLUMN bug_alerts.status IS 'Bug status: active, acknowledged, resolved, dismissed';
COMMENT ON COLUMN bug_alerts.error_message IS 'The error message if available';
COMMENT ON COLUMN bug_alerts.stack_trace IS 'Full stack trace for debugging';
