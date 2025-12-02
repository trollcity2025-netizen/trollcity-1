-- Admin Broadcasts System
-- Allows admins to send city-wide announcements to all live streams

CREATE TABLE IF NOT EXISTS admin_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  admin_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_created_at ON admin_broadcasts(created_at DESC);

-- Enable RLS
ALTER TABLE admin_broadcasts ENABLE ROW LEVEL SECURITY;

-- Only admins can insert broadcasts
CREATE POLICY "Only admins can create broadcasts"
  ON admin_broadcasts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'admin')
    )
  );

-- Everyone can read broadcasts (for real-time listeners)
CREATE POLICY "Anyone can view broadcasts"
  ON admin_broadcasts FOR SELECT
  TO authenticated
  USING (true);

-- Allow anonymous to read (for public streams)
CREATE POLICY "Public can view broadcasts"
  ON admin_broadcasts FOR SELECT
  TO anon
  USING (true);

-- Add comment
COMMENT ON TABLE admin_broadcasts IS 'City-wide admin announcements broadcast to all live streams';

