-- ============================================================
-- TROLL CITY MINOR SAFETY SYSTEM MIGRATION
-- ============================================================

-- ============================================================
-- 1. USER_PROFILES MINOR FIELDS
-- ============================================================

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS has_children BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS minor_allowed_on_stream BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS minor_violation_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS minor_last_violation TIMESTAMP NULL;

COMMENT ON COLUMN user_profiles.has_children IS 'Informational field indicating user has children';
COMMENT ON COLUMN user_profiles.minor_allowed_on_stream IS 'Enables livestream minor indicator badge';
COMMENT ON COLUMN user_profiles.minor_violation_count IS 'Tracks number of minor supervision violations';
COMMENT ON COLUMN user_profiles.minor_last_violation IS 'Timestamp of last minor violation for enforcement tracking';

-- ============================================================
-- 2. STREAM_REPORTS TABLE
-- ============================================================

-- Add missing columns first (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stream_reports') THEN
        ALTER TABLE stream_reports
        ADD COLUMN IF NOT EXISTS reporter_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS reported_stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS reported_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS report_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS screenshot_url TEXT,
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS stream_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reported_stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
    reported_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('HARASSMENT', 'SPAM', 'INAPPROPRIATE_CONTENT', 'MINOR_LEFT_UNSUPERVISED', 'OTHER')),
    description TEXT,
    screenshot_url TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for stream_reports
CREATE INDEX IF NOT EXISTS idx_stream_reports_stream ON stream_reports(reported_stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_reports_user ON stream_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_stream_reports_type ON stream_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_stream_reports_status ON stream_reports(status);
CREATE INDEX IF NOT EXISTS idx_stream_reports_created ON stream_reports(created_at);

-- RLS Policies for stream_reports
ALTER TABLE stream_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
CREATE POLICY "Users can view their own reports"
ON stream_reports FOR SELECT
TO authenticated
USING (reporter_user_id = auth.uid());

-- Officers and admins can view all reports
CREATE POLICY "Officers can view all reports"
ON stream_reports FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'troll_officer', 'lead_troll_officer', 'moderator')
    )
);

-- Anyone can create a report
CREATE POLICY "Anyone can create reports"
ON stream_reports FOR INSERT
TO authenticated
WITH CHECK (reporter_user_id = auth.uid());

-- Only officers can update reports
CREATE POLICY "Officers can update reports"
ON stream_reports FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'troll_officer', 'lead_troll_officer', 'moderator')
    )
);

-- ============================================================
-- 3. MODERATION_CASES TABLE (Troll Court Integration)
-- ============================================================

-- Add missing columns first (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'moderation_cases') THEN
        ALTER TABLE moderation_cases
        ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS violation_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS evidence_url TEXT,
        ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES stream_reports(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS case_status VARCHAR(20) DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS assigned_moderator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
        ADD COLUMN IF NOT EXISTS penalty_issued VARCHAR(50),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS moderation_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    violation_type VARCHAR(50) NOT NULL CHECK (violation_type IN ('MINOR_UNSUPERVISED_STREAM', 'HARASSMENT', 'SPAM', 'INAPPROPRIATE_CONTENT', 'TERMS_VIOLATION', 'OTHER')),
    evidence_url TEXT,
    report_id UUID REFERENCES stream_reports(id) ON DELETE SET NULL,
    case_status VARCHAR(20) DEFAULT 'pending' CHECK (case_status IN ('pending', 'under_review', 'guilty', 'not_guilty', 'dismissed')),
    assigned_moderator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    penalty_issued VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- Indexes for moderation_cases
CREATE INDEX IF NOT EXISTS idx_moderation_cases_user ON moderation_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_status ON moderation_cases(case_status);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_type ON moderation_cases(violation_type);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_created ON moderation_cases(created_at);

-- RLS Policies for moderation_cases
ALTER TABLE moderation_cases ENABLE ROW LEVEL SECURITY;

-- Users can view their own cases
CREATE POLICY "Users can view their own cases"
ON moderation_cases FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Officers can view all cases
CREATE POLICY "Officers can view all cases"
ON moderation_cases FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'troll_officer', 'lead_troll_officer', 'moderator', 'judge')
    )
);

-- Only officers can create/update cases
CREATE POLICY "Officers can manage cases"
ON moderation_cases FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'troll_officer', 'lead_troll_officer', 'moderator', 'judge')
    )
);

-- ============================================================
-- 4. MODERATION_LOGS TABLE (Audit Logging)
-- ============================================================

-- Add missing columns first (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'moderation_logs') THEN
        ALTER TABLE moderation_logs
        ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS action_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS action_description TEXT,
        ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS metadata JSONB,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS moderation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    action_description TEXT,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for moderation_logs
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user ON moderation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_action ON moderation_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created ON moderation_logs(created_at);

-- RLS Policies for moderation_logs
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs related to them
CREATE POLICY "Users can view their own logs"
ON moderation_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Officers can view all logs
CREATE POLICY "Officers can view all logs"
ON moderation_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'troll_officer', 'lead_troll_officer', 'moderator')
    )
);

-- ============================================================
-- 5. TROLL_JAIL REASON UPDATE
-- Add new jail reason for unsupervised minor
-- ============================================================

-- Note: If troll_jail table exists with a reason enum, add UNSUPERVISED_MINOR
-- Otherwise, ensure the reason column accepts this value
DO $$
BEGIN
    -- Check if troll_jail table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_jail') THEN
        -- Add comment about new reason
        COMMENT ON COLUMN troll_jail.reason IS 'Jail reason including: SPAM, HARASSMENT, TERMS_VIOLATION, UNSUPERVISED_MINOR, etc.';
    END IF;
END $$;

-- ============================================================
-- 6. STORAGE BUCKET FOR EVIDENCE
-- ============================================================

-- Create moderation evidence storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('moderation-evidence', 'moderation-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Only authenticated users can upload their own evidence
CREATE POLICY "Users can upload their own evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'moderation-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Officers can view all evidence
CREATE POLICY "Officers can view all evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'moderation-evidence' AND
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'troll_officer', 'lead_troll_officer', 'moderator')
    )
);

-- ============================================================
-- 7. HELPER FUNCTIONS
-- ============================================================

-- Function to log moderation actions
CREATE OR REPLACE FUNCTION log_moderation_action(
    p_user_id UUID,
    p_stream_id UUID,
    p_action_type VARCHAR,
    p_action_description TEXT,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO moderation_logs (user_id, stream_id, action_type, action_description, performed_by, metadata)
    VALUES (p_user_id, p_stream_id, p_action_type, p_action_description, auth.uid(), p_metadata)
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get minor violation penalty based on count
CREATE OR REPLACE FUNCTION get_minor_violation_penalty(p_user_id UUID)
RETURNS TABLE(penalty_type VARCHAR, duration_hours INTEGER, description TEXT) AS $$
DECLARE
    v_violation_count INTEGER;
BEGIN
    SELECT minor_violation_count INTO v_violation_count
    FROM user_profiles
    WHERE id = p_user_id;
    
    v_violation_count := COALESCE(v_violation_count, 0) + 1;
    
    -- Return penalty based on violation count
    CASE v_violation_count
        WHEN 1 THEN
            RETURN QUERY SELECT 'WARNING'::VARCHAR, 0, 'First offense: Official warning issued'::TEXT;
        WHEN 2 THEN
            RETURN QUERY SELECT 'TROLL_JAIL_24H'::VARCHAR, 24, 'Second offense: 24 hours in Troll Jail'::TEXT;
        WHEN 3 THEN
            RETURN QUERY SELECT 'BROADCAST_BAN_7D'::VARCHAR, 168, 'Third offense: 7-day broadcast ban'::TEXT;
        ELSE
            RETURN QUERY SELECT 'BROADCAST_BAN_PERMANENT'::VARCHAR, 0, 'Fourth offense: Permanent broadcast ban'::TEXT;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment minor violation count
CREATE OR REPLACE FUNCTION increment_minor_violation(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_new_count INTEGER;
BEGIN
    UPDATE user_profiles
    SET 
        minor_violation_count = COALESCE(minor_violation_count, 0) + 1,
        minor_last_violation = NOW()
    WHERE id = p_user_id
    RETURNING minor_violation_count INTO v_new_count;
    
    RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if broadcast officer can join guest box
CREATE OR REPLACE FUNCTION can_officer_join_guest_box(
    p_user_id UUID,
    p_stream_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_role VARCHAR;
    v_existing_count INTEGER;
BEGIN
    -- Get user role
    SELECT role INTO v_role FROM user_profiles WHERE id = p_user_id;
    
    -- If not a broadcast officer, allow (other restrictions may apply elsewhere)
    IF v_role != 'broadcast_officer' THEN
        RETURN TRUE;
    END IF;
    
    -- Count how many boxes this officer already occupies in this stream
    SELECT COUNT(*) INTO v_existing_count
    FROM stream_seat_sessions
    WHERE stream_id = p_stream_id
    AND user_id = p_user_id
    AND status = 'active';
    
    -- Broadcast officers limited to 1 box per stream
    RETURN v_existing_count < 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. VIEWS FOR DASHBOARDS
-- ============================================================

-- View for active streams with minor indicator
CREATE OR REPLACE VIEW active_streams_with_minor_indicator AS
SELECT 
    s.id AS stream_id,
    s.user_id AS streamer_id,
    up.username AS streamer_name,
    s.title,
    s.category,
    s.current_viewers,
    s.started_at,
    up.minor_allowed_on_stream,
    up.has_children,
    (SELECT COUNT(*) FROM stream_reports WHERE reported_stream_id = s.id AND status = 'pending') AS pending_reports
FROM streams s
JOIN user_profiles up ON s.user_id = up.id
WHERE s.status = 'live' AND s.is_live = true;

-- View for minor safety reports
CREATE OR REPLACE VIEW minor_safety_reports AS
SELECT 
    sr.*,
    reporter.username AS reporter_name,
    reported.username AS reported_name,
    s.title AS stream_title
FROM stream_reports sr
LEFT JOIN user_profiles reporter ON sr.reporter_user_id = reporter.id
LEFT JOIN user_profiles reported ON sr.reported_user_id = reported.id
LEFT JOIN streams s ON sr.reported_stream_id = s.id
WHERE sr.report_type = 'MINOR_LEFT_UNSUPERVISED';

-- ============================================================
-- 9. TRIGGERS
-- ============================================================

-- Trigger to log when minor indicator is enabled/disabled
CREATE OR REPLACE FUNCTION log_minor_indicator_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.minor_allowed_on_stream IS DISTINCT FROM NEW.minor_allowed_on_stream THEN
        IF NEW.minor_allowed_on_stream THEN
            PERFORM log_moderation_action(NEW.id, NULL, 'minor_indicator_enabled', 'User enabled minor supervision indicator', NULL);
        ELSE
            PERFORM log_moderation_action(NEW.id, NULL, 'minor_indicator_disabled', 'User disabled minor supervision indicator', NULL);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_minor_indicator_change ON user_profiles;
CREATE TRIGGER trg_minor_indicator_change
AFTER UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION log_minor_indicator_change();

-- ============================================================
-- END OF MIGRATION
-- ============================================================
