-- Memory Layer System - Institutional History Tables
-- Persistent history tracking for users, streams, officers, and sellers

-- User history table - tracks violations, court outcomes, missed court
CREATE TABLE IF NOT EXISTS user_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'violation', 'court_outcome', 'missed_court', 'warning', 'ban', 'kick', 'appeal'
    event_subtype VARCHAR(50), -- More specific categorization
    severity VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(200) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    officer_id UUID REFERENCES user_profiles(id), -- Officer who handled this
    court_session_id UUID REFERENCES court_sessions(id),
    points INTEGER DEFAULT 0, -- Reputation points gained/lost
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stream incidents table - auto summary after stream + flags
CREATE TABLE IF NOT EXISTS stream_incidents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    broadcaster_id UUID NOT NULL REFERENCES user_profiles(id),
    incident_type VARCHAR(50) NOT NULL, -- 'auto_summary', 'moderation_flag', 'technical_issue', 'user_report'
    severity VARCHAR(20) DEFAULT 'low',
    title VARCHAR(200) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}', -- Contains summary stats, flagged content, etc.
    flagged_content JSONB DEFAULT '[]', -- Array of flagged messages/content
    moderator_id UUID REFERENCES user_profiles(id),
    resolution_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'resolved', 'escalated'
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Officer actions table - tracks what officers did and when
CREATE TABLE IF NOT EXISTS officer_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'moderation', 'court_session', 'investigation', 'warning', 'ban', 'kick'
    action_subtype VARCHAR(50), -- More specific action
    target_user_id UUID REFERENCES user_profiles(id),
    target_stream_id UUID REFERENCES streams(id),
    court_session_id UUID REFERENCES court_sessions(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    outcome VARCHAR(50), -- 'successful', 'unsuccessful', 'escalated', 'pending'
    points_earned INTEGER DEFAULT 0, -- OWC points earned
    processing_time_minutes INTEGER, -- How long it took to resolve
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seller history table - orders, disputes, suspensions
CREATE TABLE IF NOT EXISTS seller_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'order', 'dispute', 'suspension', 'reinstatement', 'appeal'
    event_subtype VARCHAR(50),
    severity VARCHAR(20) DEFAULT 'low',
    title VARCHAR(200) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    order_id UUID, -- Reference to order if applicable
    dispute_id UUID, -- Reference to dispute if applicable
    moderator_id UUID REFERENCES user_profiles(id),
    resolution_status VARCHAR(20) DEFAULT 'pending',
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_history_user_id ON user_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_history_event_type ON user_history(event_type);
CREATE INDEX IF NOT EXISTS idx_user_history_created_at ON user_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stream_incidents_stream_id ON stream_incidents(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_incidents_broadcaster_id ON stream_incidents(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_stream_incidents_incident_type ON stream_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_stream_incidents_created_at ON stream_incidents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_officer_actions_officer_id ON officer_actions(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_actions_action_type ON officer_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_officer_actions_target_user_id ON officer_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_officer_actions_created_at ON officer_actions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_history_seller_id ON seller_history(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_history_event_type ON seller_history(event_type);
CREATE INDEX IF NOT EXISTS idx_seller_history_created_at ON seller_history(created_at DESC);

-- RLS Policies
ALTER TABLE user_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE officer_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_history ENABLE ROW LEVEL SECURITY;

-- User history policies (admins and officers can read, system can write)
CREATE POLICY "User history read access" ON user_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

CREATE POLICY "User history system write" ON user_history
    FOR ALL USING (true); -- Allow system/triggers to write

-- Stream incidents policies
CREATE POLICY "Stream incidents read access" ON stream_incidents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

CREATE POLICY "Stream incidents write access" ON stream_incidents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

-- Officer actions policies (officers can read their own, admins can read all)
CREATE POLICY "Officer actions read access" ON officer_actions
    FOR SELECT USING (
        officer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

CREATE POLICY "Officer actions write access" ON officer_actions
    FOR ALL USING (
        officer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

-- Seller history policies
CREATE POLICY "Seller history read access" ON seller_history
    FOR SELECT USING (
        seller_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

CREATE POLICY "Seller history write access" ON seller_history
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

-- Functions for logging history events
CREATE OR REPLACE FUNCTION log_user_history(
    p_user_id UUID,
    p_event_type VARCHAR(50),
    p_event_subtype VARCHAR(50) DEFAULT NULL,
    p_severity VARCHAR(20) DEFAULT 'low',
    p_title VARCHAR(200),
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_officer_id UUID DEFAULT NULL,
    p_court_session_id UUID DEFAULT NULL,
    p_points INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
    history_id UUID;
BEGIN
    INSERT INTO user_history (
        user_id, event_type, event_subtype, severity, title, description,
        metadata, officer_id, court_session_id, points
    ) VALUES (
        p_user_id, p_event_type, p_event_subtype, p_severity, p_title, p_description,
        p_metadata, p_officer_id, p_court_session_id, p_points
    ) RETURNING id INTO history_id;

    RETURN history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_stream_incident(
    p_stream_id UUID,
    p_broadcaster_id UUID,
    p_incident_type VARCHAR(50),
    p_severity VARCHAR(20) DEFAULT 'low',
    p_title VARCHAR(200),
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_flagged_content JSONB DEFAULT '[]'
) RETURNS UUID AS $$
DECLARE
    incident_id UUID;
BEGIN
    INSERT INTO stream_incidents (
        stream_id, broadcaster_id, incident_type, severity, title, description,
        metadata, flagged_content
    ) VALUES (
        p_stream_id, p_broadcaster_id, p_incident_type, p_severity, p_title, p_description,
        p_metadata, p_flagged_content
    ) RETURNING id INTO incident_id;

    RETURN incident_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_officer_action(
    p_officer_id UUID,
    p_action_type VARCHAR(50),
    p_action_subtype VARCHAR(50) DEFAULT NULL,
    p_target_user_id UUID DEFAULT NULL,
    p_target_stream_id UUID DEFAULT NULL,
    p_court_session_id UUID DEFAULT NULL,
    p_title VARCHAR(200),
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_outcome VARCHAR(50) DEFAULT NULL,
    p_points_earned INTEGER DEFAULT 0,
    p_processing_time_minutes INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    action_id UUID;
BEGIN
    INSERT INTO officer_actions (
        officer_id, action_type, action_subtype, target_user_id, target_stream_id,
        court_session_id, title, description, metadata, outcome, points_earned,
        processing_time_minutes
    ) VALUES (
        p_officer_id, p_action_type, p_action_subtype, p_target_user_id, p_target_stream_id,
        p_court_session_id, p_title, p_description, p_metadata, p_outcome, p_points_earned,
        p_processing_time_minutes
    ) RETURNING id INTO action_id;

    RETURN action_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_seller_history(
    p_seller_id UUID,
    p_event_type VARCHAR(50),
    p_event_subtype VARCHAR(50) DEFAULT NULL,
    p_severity VARCHAR(20) DEFAULT 'low',
    p_title VARCHAR(200),
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_order_id UUID DEFAULT NULL,
    p_dispute_id UUID DEFAULT NULL,
    p_moderator_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    history_id UUID;
BEGIN
    INSERT INTO seller_history (
        seller_id, event_type, event_subtype, severity, title, description,
        metadata, order_id, dispute_id, moderator_id
    ) VALUES (
        p_seller_id, p_event_type, p_event_subtype, p_severity, p_title, p_description,
        p_metadata, p_order_id, p_dispute_id, p_moderator_id
    ) RETURNING id INTO history_id;

    RETURN history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;