-- Add officer_level to user_profiles if not exists
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS officer_level INTEGER DEFAULT 1;

-- Add last_activity to officer_live_assignments
ALTER TABLE officer_live_assignments
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW();

-- Add auto_clocked_out flag
ALTER TABLE officer_live_assignments
ADD COLUMN IF NOT EXISTS auto_clocked_out BOOLEAN DEFAULT FALSE;

-- Create officer_work_sessions table
CREATE TABLE IF NOT EXISTS officer_work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out TIMESTAMPTZ,
  hours_worked NUMERIC(10, 2) DEFAULT 0,
  coins_earned INTEGER DEFAULT 0,
  payout_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'rejected'
  auto_clocked_out BOOLEAN DEFAULT FALSE,
  admin_note TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_payout_status CHECK (payout_status IN ('pending', 'approved', 'paid', 'rejected'))
);

-- Create indexes for officer_work_sessions
CREATE INDEX IF NOT EXISTS idx_officer_work_sessions_officer_id ON officer_work_sessions(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_work_sessions_stream_id ON officer_work_sessions(stream_id);
CREATE INDEX IF NOT EXISTS idx_officer_work_sessions_payout_status ON officer_work_sessions(payout_status);
CREATE INDEX IF NOT EXISTS idx_officer_work_sessions_clock_in ON officer_work_sessions(clock_in DESC);

-- Create abuse_reports table
CREATE TABLE IF NOT EXISTS abuse_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  offender_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  severity INTEGER NOT NULL DEFAULT 1, -- 1-5 scale
  reviewed BOOLEAN DEFAULT FALSE,
  admin_note TEXT,
  reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_severity CHECK (severity >= 1 AND severity <= 5)
);

-- Create indexes for abuse_reports
CREATE INDEX IF NOT EXISTS idx_abuse_reports_reported_by ON abuse_reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_stream_id ON abuse_reports(stream_id);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_offender_user_id ON abuse_reports(offender_user_id);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_reviewed ON abuse_reports(reviewed);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_created_at ON abuse_reports(created_at DESC);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_officer_work_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER officer_work_sessions_updated_at
  BEFORE UPDATE ON officer_work_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_officer_work_sessions_updated_at();

CREATE OR REPLACE FUNCTION update_abuse_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER abuse_reports_updated_at
  BEFORE UPDATE ON abuse_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_abuse_reports_updated_at();

-- RPC function to approve officer application
CREATE OR REPLACE FUNCTION approve_officer_application(app_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  -- Get user_id from application
  SELECT user_id INTO v_user_id
  FROM broadcaster_applications
  WHERE id = app_id AND application_type = 'troll_officer';

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Application not found');
  END IF;

  -- Update user role
  UPDATE user_profiles
  SET 
    role = 'troll_officer',
    is_troll_officer = TRUE,
    officer_level = 1,
    updated_at = NOW()
  WHERE id = v_user_id;

  -- Update application status
  UPDATE broadcaster_applications
  SET 
    status = 'approved',
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = app_id;

  -- Create orientation record
  INSERT INTO officer_orientations (user_id, status, created_at)
  VALUES (v_user_id, 'pending', NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN json_build_object('success', true, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE officer_work_sessions IS 'Tracks officer work shifts for payroll calculation';
COMMENT ON TABLE abuse_reports IS 'Reports submitted by officers about abusive behavior';
COMMENT ON COLUMN user_profiles.officer_level IS 'Officer level: 1=Junior (500 coins/hr), 2=Senior (800 coins/hr), 3=Commander (1200 coins/hr)';

