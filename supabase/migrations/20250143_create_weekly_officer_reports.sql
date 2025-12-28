-- Create weekly officer reports table
CREATE TABLE IF NOT EXISTS weekly_officer_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  incidents JSONB DEFAULT '[]'::jsonb, -- Array of incident types: ["Streamer Issue", "Officer Misconduct", etc.]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lead_officer_id, week_start, week_end) -- One report per officer per week
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_weekly_reports_lead_officer_id ON weekly_officer_reports(lead_officer_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week_start ON weekly_officer_reports(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week_end ON weekly_officer_reports(week_end);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_created_at ON weekly_officer_reports(created_at DESC);

-- Enable RLS
ALTER TABLE weekly_officer_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Lead officers can view their own reports
CREATE POLICY "Lead officers can view their own reports"
  ON weekly_officer_reports FOR SELECT
  USING (
    auth.uid() = lead_officer_id OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR is_admin = TRUE)
    )
  );

-- Lead officers can insert their own reports
CREATE POLICY "Lead officers can insert their own reports"
  ON weekly_officer_reports FOR INSERT
  WITH CHECK (
    auth.uid() = lead_officer_id AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND (is_lead_officer = TRUE OR role = 'admin')
    )
  );

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
  ON weekly_officer_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR is_admin = TRUE)
    )
  );

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_weekly_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_weekly_reports_updated_at ON weekly_officer_reports;
CREATE TRIGGER set_weekly_reports_updated_at
  BEFORE UPDATE ON weekly_officer_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_reports_updated_at();

-- RPC function to submit weekly report
CREATE OR REPLACE FUNCTION submit_weekly_report(
  p_lead_officer_id UUID,
  p_week_start DATE,
  p_week_end DATE,
  p_title TEXT,
  p_body TEXT,
  p_incidents JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_officer user_profiles%ROWTYPE;
BEGIN
  -- Verify the caller is a lead officer or admin
  SELECT * INTO v_lead_officer
  FROM user_profiles
  WHERE id = p_lead_officer_id;

  IF v_lead_officer IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Lead officer not found');
  END IF;

  IF NOT (v_lead_officer.is_lead_officer = TRUE OR v_lead_officer.role = 'admin') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Only lead officers can submit reports');
  END IF;

  -- Verify the caller matches the lead_officer_id (or is admin)
  IF auth.uid() != p_lead_officer_id AND NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR is_admin = TRUE)
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Unauthorized');
  END IF;

  -- Insert or update the report (upsert)
  INSERT INTO weekly_officer_reports (
    lead_officer_id,
    week_start,
    week_end,
    title,
    body,
    incidents
  ) VALUES (
    p_lead_officer_id,
    p_week_start,
    p_week_end,
    p_title,
    p_body,
    p_incidents
  )
  ON CONFLICT (lead_officer_id, week_start, week_end)
  DO UPDATE SET
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    incidents = EXCLUDED.incidents,
    updated_at = NOW();

  RETURN jsonb_build_object('success', TRUE, 'message', 'Report submitted successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION submit_weekly_report(UUID, DATE, DATE, TEXT, TEXT, JSONB) TO authenticated;

COMMENT ON TABLE weekly_officer_reports IS 'Weekly reports submitted by lead officers to owners/admins';
COMMENT ON FUNCTION submit_weekly_report IS 'Submits or updates a weekly officer report';

