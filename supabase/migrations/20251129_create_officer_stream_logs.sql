-- Create officer_stream_logs table to track officer presence in streams
CREATE TABLE IF NOT EXISTS officer_stream_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  stream_id uuid NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  actions_taken integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_officer_stream_logs_officer ON officer_stream_logs(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_stream_logs_stream ON officer_stream_logs(stream_id);
CREATE INDEX IF NOT EXISTS idx_officer_stream_logs_joined ON officer_stream_logs(joined_at DESC);

-- Enable RLS
ALTER TABLE officer_stream_logs ENABLE ROW LEVEL SECURITY;

-- Officers can view their own logs
CREATE POLICY "Officers can view own logs"
  ON officer_stream_logs FOR SELECT
  USING (
    officer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'troll_officer')
    )
  );

-- Officers can insert their own logs
CREATE POLICY "Officers can insert own logs"
  ON officer_stream_logs FOR INSERT
  WITH CHECK (
    officer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'troll_officer')
    )
  );

-- Officers can update their own logs
CREATE POLICY "Officers can update own logs"
  ON officer_stream_logs FOR UPDATE
  USING (
    officer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add comment
COMMENT ON TABLE officer_stream_logs IS 'Tracks when troll officers join and leave streams, and actions taken';

