-- Create officer_orientation_results table to store quiz answers
CREATE TABLE IF NOT EXISTS officer_orientation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  has_passed boolean NOT NULL DEFAULT false,
  submitted_answers jsonb NOT NULL DEFAULT '{}',
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id) -- One result per user
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_officer_orientation_results_user_id ON officer_orientation_results(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_orientation_results_has_passed ON officer_orientation_results(has_passed);
CREATE INDEX IF NOT EXISTS idx_officer_orientation_results_completed_at ON officer_orientation_results(completed_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_officer_orientation_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_officer_orientation_results_updated_at
  BEFORE UPDATE ON officer_orientation_results
  FOR EACH ROW
  EXECUTE FUNCTION update_officer_orientation_results_updated_at();

-- Enable RLS
ALTER TABLE officer_orientation_results ENABLE ROW LEVEL SECURITY;

-- Users can view their own results
CREATE POLICY "Users can view own orientation results"
  ON officer_orientation_results FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own results
CREATE POLICY "Users can insert own orientation results"
  ON officer_orientation_results FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own results
CREATE POLICY "Users can update own orientation results"
  ON officer_orientation_results FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins and lead officers can view all results
CREATE POLICY "Admins and lead officers can view all orientation results"
  ON officer_orientation_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
  );

COMMENT ON TABLE officer_orientation_results IS 'Stores officer orientation quiz results and submitted answers';
COMMENT ON COLUMN officer_orientation_results.submitted_answers IS 'JSON object mapping question IDs to user answers';
COMMENT ON COLUMN officer_orientation_results.score IS 'Number of correct answers';
COMMENT ON COLUMN officer_orientation_results.has_passed IS 'Whether the user passed (score >= 80%)';

