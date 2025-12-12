-- Court Docket System - Complete end-to-end court case management
-- Extends existing court_sessions with full docket functionality

-- 1. Court Docket Table
CREATE TABLE IF NOT EXISTS court_docket (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    case_type TEXT NOT NULL CHECK (case_type IN ('violation', 'appeal', 'complaint', 'other')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_session', 'completed', 'missed', 'dismissed')),
    assigned_officer UUID REFERENCES auth.users(id),
    notes TEXT,
    court_session_id UUID REFERENCES court_sessions(id),
    appeal_id UUID, -- Can reference future appeal system
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    missed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_court_docket_user ON court_docket(user_id);
CREATE INDEX IF NOT EXISTS idx_court_docket_status ON court_docket(status);
CREATE INDEX IF NOT EXISTS idx_court_docket_scheduled ON court_docket(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_court_docket_officer ON court_docket(assigned_officer);
CREATE INDEX IF NOT EXISTS idx_court_docket_session ON court_docket(court_session_id);

-- Row Level Security
ALTER TABLE court_docket ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own docket entries" ON court_docket
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Authority can view all docket entries" ON court_docket
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true OR is_lead_officer = true OR is_troll_officer = true)
        )
    );

CREATE POLICY "Authority can manage docket entries" ON court_docket
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
        )
    );

-- 2. Add court reputation score to user_profiles (separate from officer reputation)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'court_reputation_score') THEN
        ALTER TABLE user_profiles ADD COLUMN court_reputation_score INTEGER DEFAULT 100 CHECK (court_reputation_score >= 0);
    END IF;
END $$;

-- 3. Function to create docket entry from violation
CREATE OR REPLACE FUNCTION create_violation_docket(
    p_user_id UUID,
    p_case_type TEXT DEFAULT 'violation',
    p_notes TEXT DEFAULT '',
    p_delay_hours INTEGER DEFAULT 24
)
RETURNS UUID AS $$
DECLARE
    v_docket_id UUID;
    v_scheduled_at TIMESTAMPTZ;
BEGIN
    -- Calculate scheduled time
    v_scheduled_at := NOW() + (p_delay_hours || ' hours')::INTERVAL;

    -- Create docket entry
    INSERT INTO court_docket (user_id, case_type, scheduled_at, notes)
    VALUES (p_user_id, p_case_type, v_scheduled_at, p_notes)
    RETURNING id INTO v_docket_id;

    -- Deduct reputation points for violations
    UPDATE user_profiles
    SET court_reputation_score = GREATEST(0, court_reputation_score - 5)
    WHERE id = p_user_id;

    -- Create notification
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        metadata
    ) VALUES (
        p_user_id,
        'court_docket',
        'Court Docket Scheduled',
        'You have been scheduled for a court hearing regarding a recent violation.',
        jsonb_build_object(
            'docket_id', v_docket_id,
            'scheduled_at', v_scheduled_at,
            'case_type', p_case_type
        )
    );

    RETURN v_docket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to create docket entry from appeal
CREATE OR REPLACE FUNCTION create_appeal_docket(
    p_user_id UUID,
    p_appeal_reason TEXT,
    p_appeal_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_docket_id UUID;
    v_scheduled_at TIMESTAMPTZ;
    v_next_slot TIMESTAMPTZ;
BEGIN
    -- Find next available court slot (next hour from now, avoiding conflicts)
    SELECT MIN(scheduled_at)
    INTO v_next_slot
    FROM court_docket
    WHERE scheduled_at > NOW()
    AND status = 'scheduled';

    IF v_next_slot IS NULL THEN
        v_scheduled_at := NOW() + INTERVAL '1 hour';
    ELSE
        -- Schedule 30 minutes after the next slot
        v_scheduled_at := v_next_slot + INTERVAL '30 minutes';
    END IF;

    -- Create docket entry
    INSERT INTO court_docket (user_id, case_type, scheduled_at, notes, appeal_id)
    VALUES (p_user_id, 'appeal', v_scheduled_at, p_appeal_reason, p_appeal_id)
    RETURNING id INTO v_docket_id;

    -- Create notification
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        metadata
    ) VALUES (
        p_user_id,
        'court_docket',
        'Appeal Hearing Scheduled',
        'Your appeal has been scheduled for court review.',
        jsonb_build_object(
            'docket_id', v_docket_id,
            'scheduled_at', v_scheduled_at,
            'case_type', 'appeal'
        )
    );

    RETURN v_docket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to auto-start court when authority + docket users present
CREATE OR REPLACE FUNCTION auto_start_court_with_docket(
    p_authority_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_docket_count INTEGER;
    v_session_id UUID;
BEGIN
    -- Check if there are scheduled docket entries
    SELECT COUNT(*)
    INTO v_docket_count
    FROM court_docket
    WHERE status = 'scheduled'
    AND scheduled_at <= NOW() + INTERVAL '1 hour'; -- Within next hour

    -- Only start if there are docket entries to handle
    IF v_docket_count = 0 THEN
        RETURN FALSE;
    END IF;

    -- Try to start court session
    UPDATE court_sessions
    SET
        status = 'live',
        started_by = p_authority_user_id,
        started_at = NOW(),
        updated_at = NOW()
    WHERE status = 'waiting';

    -- Get the session ID
    SELECT id INTO v_session_id
    FROM court_sessions
    WHERE status = 'live'
    ORDER BY started_at DESC
    LIMIT 1;

    -- Update docket entries to in_session
    UPDATE court_docket
    SET
        status = 'in_session',
        court_session_id = v_session_id,
        updated_at = NOW()
    WHERE status = 'scheduled'
    AND scheduled_at <= NOW() + INTERVAL '1 hour';

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to handle missed court appearances
CREATE OR REPLACE FUNCTION process_missed_court(
    p_docket_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Update docket status
    UPDATE court_docket
    SET
        status = 'missed',
        missed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_docket_id
    RETURNING user_id INTO v_user_id;

    -- Deduct reputation points
    UPDATE user_profiles
    SET court_reputation_score = GREATEST(0, court_reputation_score - 10)
    WHERE id = v_user_id;

    -- Create notification
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        metadata
    ) VALUES (
        v_user_id,
        'court_missed',
        'Court Appearance Missed',
        'You missed your scheduled court appearance. Your reputation has been reduced.',
        jsonb_build_object('docket_id', p_docket_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to complete court case
CREATE OR REPLACE FUNCTION complete_court_case(
    p_docket_id UUID,
    p_verdict TEXT DEFAULT 'resolved'
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Update docket status
    UPDATE court_docket
    SET
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW(),
        notes = COALESCE(notes, '') || ' Verdict: ' || p_verdict
    WHERE id = p_docket_id
    RETURNING user_id INTO v_user_id;

    -- Restore some reputation points for attending
    UPDATE user_profiles
    SET court_reputation_score = LEAST(100, court_reputation_score + 2)
    WHERE id = v_user_id;

    -- Create notification
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        metadata
    ) VALUES (
        v_user_id,
        'court_completed',
        'Court Case Resolved',
        'Your court case has been resolved.',
        jsonb_build_object(
            'docket_id', p_docket_id,
            'verdict', p_verdict
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to get user's docket entries
CREATE OR REPLACE FUNCTION get_user_docket(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
    id UUID,
    case_type TEXT,
    scheduled_at TIMESTAMPTZ,
    status TEXT,
    assigned_officer UUID,
    notes TEXT,
    court_session_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cd.id,
        cd.case_type,
        cd.scheduled_at,
        cd.status,
        cd.assigned_officer,
        cd.notes,
        cd.court_session_id
    FROM court_docket cd
    WHERE cd.user_id = p_user_id
    ORDER BY cd.scheduled_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to get all docket entries (for admins)
CREATE OR REPLACE FUNCTION get_all_docket_entries()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    username TEXT,
    case_type TEXT,
    scheduled_at TIMESTAMPTZ,
    status TEXT,
    assigned_officer UUID,
    officer_username TEXT,
    notes TEXT,
    court_session_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cd.id,
        cd.user_id,
        up.username,
        cd.case_type,
        cd.scheduled_at,
        cd.status,
        cd.assigned_officer,
        officer.username as officer_username,
        cd.notes,
        cd.court_session_id
    FROM court_docket cd
    LEFT JOIN user_profiles up ON cd.user_id = up.id
    LEFT JOIN user_profiles officer ON cd.assigned_officer = officer.id
    ORDER BY cd.scheduled_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to get public anonymized docket board
CREATE OR REPLACE FUNCTION get_public_docket_board()
RETURNS TABLE (
    case_type TEXT,
    scheduled_at TIMESTAMPTZ,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cd.case_type,
        cd.scheduled_at,
        cd.status
    FROM court_docket cd
    WHERE cd.status IN ('scheduled', 'in_session')
    ORDER BY cd.scheduled_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_court_docket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_court_docket_updated_at
    BEFORE UPDATE ON court_docket
    FOR EACH ROW
    EXECUTE FUNCTION update_court_docket_updated_at();

-- 12. Function to check for missed court appearances (run periodically)
CREATE OR REPLACE FUNCTION check_missed_court_appearances()
RETURNS INTEGER AS $$
DECLARE
    missed_count INTEGER := 0;
    docket_record RECORD;
BEGIN
    FOR docket_record IN
        SELECT id
        FROM court_docket
        WHERE status = 'scheduled'
        AND scheduled_at < NOW() - INTERVAL '15 minutes' -- 15 minute grace period
    LOOP
        PERFORM process_missed_court(docket_record.id);
        missed_count := missed_count + 1;
    END LOOP;

    RETURN missed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_violation_docket(UUID, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION create_appeal_docket(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_start_court_with_docket(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_missed_court(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_court_case(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_docket(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_docket_entries() TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_docket_board() TO authenticated;
GRANT EXECUTE ON FUNCTION check_missed_court_appearances() TO authenticated;

-- Add comments
COMMENT ON TABLE court_docket IS 'Court docket system for managing scheduled court cases and hearings';
COMMENT ON FUNCTION create_violation_docket IS 'Creates a docket entry when a user receives a violation/warning';
COMMENT ON FUNCTION create_appeal_docket IS 'Creates a docket entry when a user submits an appeal';
COMMENT ON FUNCTION auto_start_court_with_docket IS 'Auto-starts court when authority is present and docket entries exist';
COMMENT ON FUNCTION process_missed_court IS 'Handles missed court appearances with reputation penalties';
COMMENT ON FUNCTION complete_court_case IS 'Marks a court case as completed with verdict';
COMMENT ON FUNCTION get_user_docket IS 'Returns docket entries for a specific user';
COMMENT ON FUNCTION get_all_docket_entries IS 'Returns all docket entries with user details (admin only)';
COMMENT ON FUNCTION get_public_docket_board IS 'Returns anonymized public docket board';
COMMENT ON FUNCTION check_missed_court_appearances IS 'Processes missed court appearances (run by cron job)';