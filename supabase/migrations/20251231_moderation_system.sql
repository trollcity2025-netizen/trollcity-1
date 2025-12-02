-- Officer Moderation System
-- Tables for reports, actions, and officer role management

-- 1. moderation_reports table
CREATE TABLE IF NOT EXISTS moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  target_user_id UUID NULL REFERENCES user_profiles(id) ON DELETE SET NULL,
  stream_id UUID NULL REFERENCES streams(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','reviewing','resolved','action_taken','rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL,
  reviewed_by UUID NULL REFERENCES user_profiles(id) ON DELETE SET NULL
);

-- Indexes for moderation_reports
CREATE INDEX IF NOT EXISTS idx_moderation_reports_reporter_id ON moderation_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_target_user_id ON moderation_reports(target_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_stream_id ON moderation_reports(stream_id);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_status ON moderation_reports(status);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_created_at ON moderation_reports(created_at);

-- 2. moderation_actions table
CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL CHECK (action_type IN ('warn','suspend_stream','ban_user','unban_user')),
  target_user_id UUID NULL REFERENCES user_profiles(id) ON DELETE SET NULL,
  stream_id UUID NULL REFERENCES streams(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  action_details TEXT NULL,
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NULL,
  report_id UUID NULL REFERENCES moderation_reports(id) ON DELETE SET NULL
);

-- Indexes for moderation_actions
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target_user_id ON moderation_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_stream_id ON moderation_actions(stream_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_created_by ON moderation_actions(created_by);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_action_type ON moderation_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_report_id ON moderation_actions(report_id);

-- 3. Extend user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'is_officer'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_officer BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'is_banned'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_banned BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Update existing officers if is_troll_officer exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'is_troll_officer'
  ) THEN
    UPDATE user_profiles 
    SET is_officer = COALESCE(is_troll_officer, false)
    WHERE is_officer IS NULL OR is_officer = false;
  END IF;
END $$;

-- RLS Policies for moderation_reports
ALTER TABLE moderation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reports"
  ON moderation_reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "Officers can view all reports"
  ON moderation_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND (is_officer = true OR role = 'admin' OR role = 'troll_officer')
    )
  );

CREATE POLICY "Users can create reports"
  ON moderation_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Officers can update reports"
  ON moderation_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND (is_officer = true OR role = 'admin' OR role = 'troll_officer')
    )
  );

-- RLS Policies for moderation_actions
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view actions affecting them"
  ON moderation_actions FOR SELECT
  USING (auth.uid() = target_user_id);

CREATE POLICY "Officers can view all actions"
  ON moderation_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND (is_officer = true OR role = 'admin' OR role = 'troll_officer')
    )
  );

CREATE POLICY "Officers can create actions"
  ON moderation_actions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND (is_officer = true OR role = 'admin' OR role = 'troll_officer')
    )
  );

-- View for moderation reports with user info
CREATE OR REPLACE VIEW moderation_reports_view AS
SELECT 
  mr.id,
  mr.reporter_id,
  reporter.username AS reporter_username,
  mr.target_user_id,
  target_user.username AS target_username,
  mr.stream_id,
  s.title AS stream_title,
  mr.reason,
  mr.description,
  mr.status,
  mr.created_at,
  mr.resolved_at,
  mr.reviewed_by,
  reviewer.username AS reviewer_username
FROM moderation_reports mr
LEFT JOIN user_profiles reporter ON reporter.id = mr.reporter_id
LEFT JOIN user_profiles target_user ON target_user.id = mr.target_user_id
LEFT JOIN streams s ON s.id = mr.stream_id
LEFT JOIN user_profiles reviewer ON reviewer.id = mr.reviewed_by
ORDER BY mr.created_at DESC;

GRANT SELECT ON moderation_reports_view TO authenticated;

-- View for moderation actions with user info
CREATE OR REPLACE VIEW moderation_actions_view AS
SELECT 
  ma.id,
  ma.action_type,
  ma.target_user_id,
  target_user.username AS target_username,
  ma.stream_id,
  s.title AS stream_title,
  ma.reason,
  ma.action_details,
  ma.created_by,
  creator.username AS creator_username,
  ma.created_at,
  ma.expires_at,
  ma.report_id
FROM moderation_actions ma
LEFT JOIN user_profiles target_user ON target_user.id = ma.target_user_id
LEFT JOIN streams s ON s.id = ma.stream_id
LEFT JOIN user_profiles creator ON creator.id = ma.created_by
ORDER BY ma.created_at DESC;

GRANT SELECT ON moderation_actions_view TO authenticated;

