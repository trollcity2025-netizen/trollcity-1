
-- Ensure stream_reports table exists for Admin Reports Panel
CREATE TABLE IF NOT EXISTS stream_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL, -- Can reference streams(id) but sometimes we might keep reports for deleted streams
  reporter_id UUID REFERENCES user_profiles(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, resolved, dismissed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES user_profiles(id)
);

-- Index for faster admin lookups
CREATE INDEX IF NOT EXISTS idx_stream_reports_status ON stream_reports(status);
CREATE INDEX IF NOT EXISTS idx_stream_reports_created_at ON stream_reports(created_at);

-- RLS
ALTER TABLE stream_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert reports" ON stream_reports;
CREATE POLICY "Anyone can insert reports" ON stream_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins and Mods can view reports" ON stream_reports;
CREATE POLICY "Admins and Mods can view reports" ON stream_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'moderator') OR is_admin = true))
  );

DROP POLICY IF EXISTS "Admins and Mods can update reports" ON stream_reports;
CREATE POLICY "Admins and Mods can update reports" ON stream_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'moderator') OR is_admin = true))
  );
