-- Escalation Matrix System - Law & Order Completion
-- Deterministic rules for violations and consequences

-- Escalation matrix table - configurable violation consequence rules
CREATE TABLE IF NOT EXISTS escalation_matrix (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    violation_type VARCHAR(50) NOT NULL, -- 'spam', 'harassment', 'inappropriate_content', 'copyright', 'fraud', etc.
    severity_level INTEGER NOT NULL, -- 1-5 scale
    violation_count_threshold INTEGER NOT NULL, -- How many violations trigger this consequence
    time_window_days INTEGER NOT NULL, -- Time window to count violations (0 = all time)
    consequence_type VARCHAR(50) NOT NULL, -- 'warning', 'timeout', 'ban', 'court_session', 'permanent_ban'
    consequence_duration_minutes INTEGER, -- For timeouts/bans (NULL for permanent)
    court_required BOOLEAN DEFAULT FALSE, -- Whether this requires court review
    auto_escalate BOOLEAN DEFAULT TRUE, -- Whether to apply automatically or require review
    points_deducted INTEGER DEFAULT 0, -- Reputation points to deduct
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(violation_type, severity_level, violation_count_threshold)
);

-- Insert default escalation rules
INSERT INTO escalation_matrix (
    violation_type, severity_level, violation_count_threshold, time_window_days,
    consequence_type, consequence_duration_minutes, court_required, auto_escalate, points_deducted
) VALUES
-- Spam violations
('spam', 1, 1, 1, 'warning', NULL, FALSE, TRUE, 5),
('spam', 2, 3, 7, 'timeout', 60, FALSE, TRUE, 15),
('spam', 3, 5, 30, 'timeout', 1440, FALSE, TRUE, 30), -- 24 hours
('spam', 4, 10, 90, 'ban', 10080, TRUE, FALSE, 50), -- 1 week, court required

-- Harassment violations
('harassment', 1, 1, 1, 'warning', NULL, FALSE, TRUE, 10),
('harassment', 2, 2, 7, 'timeout', 120, FALSE, TRUE, 25),
('harassment', 3, 3, 30, 'court_session', NULL, TRUE, TRUE, 40),
('harassment', 4, 5, 90, 'ban', 43200, TRUE, FALSE, 75), -- 30 days

-- Inappropriate content
('inappropriate_content', 1, 1, 1, 'warning', NULL, FALSE, TRUE, 15),
('inappropriate_content', 2, 2, 7, 'timeout', 180, FALSE, TRUE, 35),
('inappropriate_content', 3, 3, 30, 'court_session', NULL, TRUE, TRUE, 55),
('inappropriate_content', 4, 4, 60, 'ban', 10080, TRUE, FALSE, 80), -- 1 week

-- Copyright violations
('copyright', 1, 1, 0, 'warning', NULL, FALSE, TRUE, 20),
('copyright', 2, 2, 0, 'timeout', 2880, FALSE, TRUE, 50), -- 48 hours
('copyright', 3, 3, 0, 'ban', 43200, TRUE, FALSE, 100), -- 30 days

-- Fraud violations
('fraud', 1, 1, 0, 'warning', NULL, FALSE, TRUE, 25),
('fraud', 2, 2, 0, 'court_session', NULL, TRUE, TRUE, 60),
('fraud', 3, 3, 0, 'ban', 525600, TRUE, FALSE, 200); -- 1 year

-- Court rulings archive - public anonymized rulings
CREATE TABLE IF NOT EXISTS court_rulings_archive (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    court_session_id UUID REFERENCES court_sessions(id),
    case_type VARCHAR(50) NOT NULL, -- 'harassment', 'inappropriate_content', 'fraud', etc.
    severity_level INTEGER NOT NULL,
    ruling VARCHAR(50) NOT NULL, -- 'guilty', 'not_guilty', 'dismissed', 'appeal_granted'
    consequence_applied VARCHAR(100), -- Human readable consequence
    duration_applied VARCHAR(100), -- Duration if applicable
    reasoning_summary TEXT, -- Anonymized reasoning
    precedent_citation TEXT, -- Reference to similar cases
    judge_notes TEXT, -- Internal judge notes (not public)
    is_public BOOLEAN DEFAULT TRUE, -- Whether to show in public archive
    appeal_status VARCHAR(20) DEFAULT 'none', -- 'none', 'pending', 'granted', 'denied'
    appealed_ruling_id UUID REFERENCES court_rulings_archive(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_escalation_matrix_violation_type ON escalation_matrix(violation_type);
CREATE INDEX IF NOT EXISTS idx_escalation_matrix_active ON escalation_matrix(is_active);
CREATE INDEX IF NOT EXISTS idx_court_rulings_archive_case_type ON court_rulings_archive(case_type);
CREATE INDEX IF NOT EXISTS idx_court_rulings_archive_public ON court_rulings_archive(is_public);
CREATE INDEX IF NOT EXISTS idx_court_rulings_archive_created_at ON court_rulings_archive(created_at DESC);

-- RLS Policies
ALTER TABLE escalation_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_rulings_archive ENABLE ROW LEVEL SECURITY;

-- Escalation matrix - admins and officers can read, only admins can modify
CREATE POLICY "Escalation matrix read access" ON escalation_matrix
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

CREATE POLICY "Escalation matrix admin write" ON escalation_matrix
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

-- Court rulings - public read for anonymized data, admin/officer full access
CREATE POLICY "Court rulings public read" ON court_rulings_archive
    FOR SELECT USING (is_public = TRUE);

CREATE POLICY "Court rulings admin read" ON court_rulings_archive
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

CREATE POLICY "Court rulings admin write" ON court_rulings_archive
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

-- Functions for escalation system
CREATE OR REPLACE FUNCTION check_violation_escalation(
    p_user_id UUID,
    p_violation_type VARCHAR(50),
    p_severity_level INTEGER DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
    violation_count INTEGER;
    applicable_rule RECORD;
    result JSONB;
BEGIN
    -- Count violations in the relevant time window
    SELECT COUNT(*) INTO violation_count
    FROM user_history
    WHERE user_id = p_user_id
      AND event_type = 'violation'
      AND metadata->>'violation_type' = p_violation_type
      AND (SELECT time_window_days FROM escalation_matrix
           WHERE violation_type = p_violation_type
           AND severity_level = p_severity_level
           ORDER BY violation_count_threshold DESC LIMIT 1) = 0
      OR created_at >= NOW() - INTERVAL '1 day' * (
          SELECT time_window_days FROM escalation_matrix
          WHERE violation_type = p_violation_type
          AND severity_level = p_severity_level
          ORDER BY violation_count_threshold DESC LIMIT 1
      );

    -- Find applicable escalation rule
    SELECT * INTO applicable_rule
    FROM escalation_matrix
    WHERE violation_type = p_violation_type
      AND severity_level = p_severity_level
      AND violation_count_threshold <= violation_count
      AND is_active = TRUE
    ORDER BY violation_count_threshold DESC
    LIMIT 1;

    IF applicable_rule IS NULL THEN
        -- No escalation needed
        RETURN jsonb_build_object(
            'escalate', FALSE,
            'violation_count', violation_count
        );
    END IF;

    -- Return escalation details
    RETURN jsonb_build_object(
        'escalate', TRUE,
        'consequence_type', applicable_rule.consequence_type,
        'consequence_duration_minutes', applicable_rule.consequence_duration_minutes,
        'court_required', applicable_rule.court_required,
        'auto_escalate', applicable_rule.auto_escalate,
        'points_deducted', applicable_rule.points_deducted,
        'violation_count', violation_count,
        'rule_id', applicable_rule.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to apply violation consequence
CREATE OR REPLACE FUNCTION apply_violation_consequence(
    p_user_id UUID,
    p_violation_type VARCHAR(50),
    p_severity_level INTEGER,
    p_officer_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    escalation_result JSONB;
    consequence_type VARCHAR(50);
    duration_minutes INTEGER;
    points_deducted INTEGER;
    court_session_id UUID;
BEGIN
    -- Check for escalation
    SELECT check_violation_escalation(p_user_id, p_violation_type, p_severity_level) INTO escalation_result;

    IF NOT (escalation_result->>'escalate')::BOOLEAN THEN
        -- Log the violation but no escalation
        PERFORM log_user_history(
            p_user_id, 'violation', 'escalation_check',
            CASE WHEN p_severity_level >= 4 THEN 'high'
                 WHEN p_severity_level >= 2 THEN 'medium'
                 ELSE 'low' END,
            'Violation logged: ' || p_violation_type,
            jsonb_build_object(
                'violation_type', p_violation_type,
                'severity_level', p_severity_level,
                'escalation_checked', TRUE,
                'escalation_result', 'none'
            ),
            p_officer_id
        );

        RETURN jsonb_build_object('success', TRUE, 'escalated', FALSE);
    END IF;

    -- Apply escalation
    consequence_type := escalation_result->>'consequence_type';
    duration_minutes := (escalation_result->>'consequence_duration_minutes')::INTEGER;
    points_deducted := (escalation_result->>'points_deducted')::INTEGER;

    -- Apply reputation penalty
    IF points_deducted > 0 THEN
        PERFORM update_user_reputation(
            p_user_id, -points_deducted, 'violation_penalty',
            'Penalty for ' || p_violation_type || ' violation', p_officer_id,
            jsonb_build_object('violation_type', p_violation_type, 'severity', p_severity_level)
        );
    END IF;

    -- Apply consequence based on type
    CASE consequence_type
        WHEN 'warning' THEN
            -- Send warning notification
            PERFORM send_notification(
                p_user_id, 'violation_warning', 'Violation Warning',
                'You have received a warning for: ' || p_violation_type || '. Continued violations may result in further action.',
                jsonb_build_object('violation_type', p_violation_type, 'severity', p_severity_level)
            );

        WHEN 'timeout' THEN
            -- Apply timeout (temporary ban)
            UPDATE user_profiles
            SET is_kicked = TRUE,
                kicked_until = NOW() + INTERVAL '1 minute' * duration_minutes,
                updated_at = NOW()
            WHERE id = p_user_id;

        WHEN 'ban' THEN
            -- Apply ban
            UPDATE user_profiles
            SET is_banned = TRUE,
                ban_expires_at = CASE WHEN duration_minutes IS NULL THEN NULL
                                     ELSE NOW() + INTERVAL '1 minute' * duration_minutes END,
                updated_at = NOW()
            WHERE id = p_user_id;

        WHEN 'court_session' THEN
            -- Create court session
            INSERT INTO court_sessions (
                defendant_id, case_type, severity_level, status,
                created_by, description
            ) VALUES (
                p_user_id, p_violation_type, p_severity_level, 'scheduled',
                p_officer_id, 'Auto-escalated court session for ' || p_violation_type
            ) RETURNING id INTO court_session_id;

        WHEN 'permanent_ban' THEN
            -- Permanent ban
            UPDATE user_profiles
            SET is_banned = TRUE,
                ban_expires_at = NULL,
                updated_at = NOW()
            WHERE id = p_user_id;
    END CASE;

    -- Log the violation and consequence
    PERFORM log_user_history(
        p_user_id, 'violation', consequence_type,
        CASE WHEN p_severity_level >= 4 THEN 'high'
             WHEN p_severity_level >= 2 THEN 'medium'
             ELSE 'low' END,
        'Violation consequence applied: ' || consequence_type || ' for ' || p_violation_type,
        jsonb_build_object(
            'violation_type', p_violation_type,
            'severity_level', p_severity_level,
            'consequence_type', consequence_type,
            'duration_minutes', duration_minutes,
            'points_deducted', points_deducted,
            'court_session_id', court_session_id
        ),
        p_officer_id
    );

    -- Log officer action
    PERFORM log_officer_action(
        p_officer_id, 'moderation', 'violation_handling',
        p_user_id, NULL, court_session_id,
        'Applied ' || consequence_type || ' for ' || p_violation_type || ' violation',
        p_reason, jsonb_build_object(
            'violation_type', p_violation_type,
            'consequence_type', consequence_type,
            'severity_level', p_severity_level
        ), 'successful', 1, NULL
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'escalated', TRUE,
        'consequence_type', consequence_type,
        'court_session_id', court_session_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to archive court ruling
CREATE OR REPLACE FUNCTION archive_court_ruling(
    p_court_session_id UUID,
    p_ruling VARCHAR(50),
    p_consequence_applied VARCHAR(100),
    p_duration_applied VARCHAR(100),
    p_reasoning_summary TEXT,
    p_precedent_citation TEXT,
    p_judge_notes TEXT,
    p_is_public BOOLEAN DEFAULT TRUE
) RETURNS UUID AS $$
DECLARE
    ruling_id UUID;
    case_type VARCHAR(50);
    severity_level INTEGER;
BEGIN
    -- Get case details from court session
    SELECT case_type, severity_level INTO case_type, severity_level
    FROM court_sessions
    WHERE id = p_court_session_id;

    -- Insert ruling archive
    INSERT INTO court_rulings_archive (
        court_session_id, case_type, severity_level, ruling,
        consequence_applied, duration_applied, reasoning_summary,
        precedent_citation, judge_notes, is_public
    ) VALUES (
        p_court_session_id, case_type, severity_level, p_ruling,
        p_consequence_applied, p_duration_applied, p_reasoning_summary,
        p_precedent_citation, p_judge_notes, p_is_public
    ) RETURNING id INTO ruling_id;

    RETURN ruling_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;