-- Moderation System Enhancements
-- Add ban time limits, reporting chain, and kick/ban reason requirements

-- Add ban_expires_at to moderation_actions
ALTER TABLE moderation_actions 
ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMPTZ;

-- Add ban_duration_hours to moderation_actions (for reference)
ALTER TABLE moderation_actions 
ADD COLUMN IF NOT EXISTS ban_duration_hours INTEGER;

-- Add honesty_message_shown to moderation_actions
ALTER TABLE moderation_actions 
ADD COLUMN IF NOT EXISTS honesty_message_shown BOOLEAN DEFAULT false;

-- Update moderation_actions to require reason
ALTER TABLE moderation_actions 
ALTER COLUMN reason SET NOT NULL;

-- Create escalation_reports table for user -> officer -> admin chain
CREATE TABLE IF NOT EXISTS escalation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_report_id UUID REFERENCES moderation_reports(id) ON DELETE CASCADE,
  escalated_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  escalated_to UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  escalation_level TEXT NOT NULL CHECK (escalation_level IN ('officer', 'admin')),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_escalation_reports_original ON escalation_reports(original_report_id);
CREATE INDEX IF NOT EXISTS idx_escalation_reports_escalated_by ON escalation_reports(escalated_by);
CREATE INDEX IF NOT EXISTS idx_escalation_reports_escalated_to ON escalation_reports(escalated_to);
CREATE INDEX IF NOT EXISTS idx_escalation_reports_status ON escalation_reports(status);

ALTER TABLE escalation_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own escalations
CREATE POLICY "Users can view own escalations"
  ON escalation_reports FOR SELECT
  USING (escalated_by = auth.uid() OR escalated_to = auth.uid());

-- Officers can view escalations to them
CREATE POLICY "Officers can view escalations to them"
  ON escalation_reports FOR SELECT
  USING (
    escalated_to = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND (is_troll_officer = true OR role = 'troll_officer')
    )
  );

-- Admins can view all escalations
CREATE POLICY "Admins can view all escalations"
  ON escalation_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

GRANT ALL ON escalation_reports TO authenticated;

-- Function to escalate report to officer
CREATE OR REPLACE FUNCTION escalate_to_officer(
  p_report_id UUID,
  p_escalator_id UUID,
  p_reason TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report RECORD;
  v_officer_id UUID;
BEGIN
  -- Get report
  SELECT * INTO v_report
  FROM moderation_reports
  WHERE id = p_report_id;

  IF v_report IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;

  -- Find an available officer (first active officer)
  SELECT id INTO v_officer_id
  FROM user_profiles
  WHERE (is_troll_officer = true OR role = 'troll_officer')
    AND is_officer_active = true
    AND is_banned = false
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_officer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No available officers');
  END IF;

  -- Create escalation
  INSERT INTO escalation_reports (
    original_report_id,
    escalated_by,
    escalated_to,
    escalation_level,
    reason,
    description,
    status
  ) VALUES (
    p_report_id,
    p_escalator_id,
    v_officer_id,
    'officer',
    p_reason,
    p_description,
    'pending'
  );

  -- Create notification for officer
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
    v_officer_id,
    'moderation_action',
    'Report Escalated',
    format('A user has escalated a report to you: %s', p_reason),
    jsonb_build_object('report_id', p_report_id, 'escalation_id', (SELECT id FROM escalation_reports WHERE original_report_id = p_report_id ORDER BY created_at DESC LIMIT 1))
  );

  RETURN jsonb_build_object('success', true, 'message', 'Report escalated to officer');
END;
$$;

GRANT EXECUTE ON FUNCTION escalate_to_officer(UUID, UUID, TEXT, TEXT) TO authenticated;

-- Function to escalate report to admin
CREATE OR REPLACE FUNCTION escalate_to_admin(
  p_report_id UUID,
  p_officer_id UUID,
  p_reason TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report RECORD;
  v_admin_id UUID;
BEGIN
  -- Verify officer
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = p_officer_id AND (is_troll_officer = true OR role = 'troll_officer')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Officer access required');
  END IF;

  -- Get report
  SELECT * INTO v_report
  FROM moderation_reports
  WHERE id = p_report_id;

  IF v_report IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Report not found');
  END IF;

  -- Find an admin
  SELECT id INTO v_admin_id
  FROM user_profiles
  WHERE (role = 'admin' OR is_admin = true)
    AND is_banned = false
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No available admins');
  END IF;

  -- Create escalation
  INSERT INTO escalation_reports (
    original_report_id,
    escalated_by,
    escalated_to,
    escalation_level,
    reason,
    description,
    status
  ) VALUES (
    p_report_id,
    p_officer_id,
    v_admin_id,
    'admin',
    p_reason,
    p_description,
    'pending'
  );

  -- Create notification for admin
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
    v_admin_id,
    'moderation_action',
    'Report Escalated by Officer',
    format('An officer has escalated a report to you: %s', p_reason),
    jsonb_build_object('report_id', p_report_id, 'escalation_id', (SELECT id FROM escalation_reports WHERE original_report_id = p_report_id ORDER BY created_at DESC LIMIT 1))
  );

  RETURN jsonb_build_object('success', true, 'message', 'Report escalated to admin');
END;
$$;

GRANT EXECUTE ON FUNCTION escalate_to_admin(UUID, UUID, TEXT, TEXT) TO authenticated;

COMMENT ON TABLE escalation_reports IS 'Tracks escalation chain: user -> officer -> admin';
COMMENT ON COLUMN moderation_actions.ban_expires_at IS 'When the ban expires (NULL for permanent)';
COMMENT ON COLUMN moderation_actions.ban_duration_hours IS 'Duration of ban in hours';
COMMENT ON COLUMN moderation_actions.honesty_message_shown IS 'Whether honesty message was shown to user';

