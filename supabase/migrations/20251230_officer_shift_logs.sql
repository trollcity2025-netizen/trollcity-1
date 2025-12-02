-- Officer Shift Logs Table
-- Tracks officer work shifts for clock-in/clock-out and earnings

CREATE TABLE IF NOT EXISTS officer_shift_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  shift_start timestamptz NOT NULL DEFAULT now(),
  shift_end timestamptz,
  last_activity timestamptz NOT NULL DEFAULT now(),
  hours_worked numeric(10,2),
  coins_earned integer DEFAULT 0,
  auto_clocked_out boolean DEFAULT false,
  paid boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_officer_shift_logs_officer ON officer_shift_logs(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_shift_logs_active ON officer_shift_logs(officer_id, shift_end) WHERE shift_end IS NULL;
CREATE INDEX IF NOT EXISTS idx_officer_shift_logs_created ON officer_shift_logs(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_officer_shift_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_officer_shift_logs_updated_at
  BEFORE UPDATE ON officer_shift_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_officer_shift_logs_updated_at();

-- Enable RLS
ALTER TABLE officer_shift_logs ENABLE ROW LEVEL SECURITY;

-- Officers can view their own shift logs
CREATE POLICY "Officers can view own shift logs"
  ON officer_shift_logs FOR SELECT
  USING (
    officer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'troll_officer')
    )
  );

-- Officers can insert their own shift logs
CREATE POLICY "Officers can insert own shift logs"
  ON officer_shift_logs FOR INSERT
  WITH CHECK (
    officer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'troll_officer')
    )
  );

-- Officers can update their own shift logs
CREATE POLICY "Officers can update own shift logs"
  ON officer_shift_logs FOR UPDATE
  USING (
    officer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Comment
COMMENT ON TABLE officer_shift_logs IS 'Tracks officer work shifts, hours worked, and coins earned. Auto-clocks out after 6 hours or 30 minutes of inactivity.';

