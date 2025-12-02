-- Scheduled Admin Announcements
-- Allows admins to schedule announcements for future delivery

CREATE TABLE IF NOT EXISTS scheduled_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  scheduled_time timestamptz NOT NULL,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  is_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_scheduled_announcements_scheduled_time ON scheduled_announcements(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_announcements_is_sent ON scheduled_announcements(is_sent);

-- Enable RLS
ALTER TABLE scheduled_announcements ENABLE ROW LEVEL SECURITY;

-- Only admins can create scheduled announcements
CREATE POLICY "Only admins can create scheduled announcements"
  ON scheduled_announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'admin')
    )
  );

-- Only admins can view scheduled announcements
CREATE POLICY "Only admins can view scheduled announcements"
  ON scheduled_announcements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'admin')
    )
  );

-- Only admins can update scheduled announcements
CREATE POLICY "Only admins can update scheduled announcements"
  ON scheduled_announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'admin')
    )
  );

-- Add comment
COMMENT ON TABLE scheduled_announcements IS 'Scheduled admin announcements that are sent at a specific time';

