-- Create mobile_errors table for tracking mobile errors in the database
CREATE TABLE IF NOT EXISTS mobile_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  stack TEXT,
  component TEXT,
  user_id UUID REFERENCES auth.users(id),
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE mobile_errors ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert errors (mobile app needs to report errors)
CREATE POLICY "Allow anyone to insert mobile errors"
  ON mobile_errors FOR INSERT
  WITH CHECK (true);

-- Allow admins to view all errors
CREATE POLICY "Allow admins to view mobile errors"
  ON mobile_errors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true)
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_mobile_errors_created_at ON mobile_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mobile_errors_user_id ON mobile_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_errors_component ON mobile_errors(component);
