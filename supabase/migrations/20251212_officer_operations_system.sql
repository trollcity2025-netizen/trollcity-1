-- Officer Operations System - Shift scheduling, patrol assignments, internal chat, panic button
-- Complete officer workflow management

-- Officer shifts table
CREATE TABLE IF NOT EXISTS officer_shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    shift_start TIMESTAMPTZ NOT NULL,
    shift_end TIMESTAMPTZ NOT NULL,
    shift_type VARCHAR(20) DEFAULT 'regular', -- 'regular', 'emergency', 'court', 'special'
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'active', 'completed', 'missed', 'cancelled'
    patrol_area VARCHAR(50), -- 'general', 'marketplace', 'streams', 'court', 'emergency'
    notes TEXT,
    assigned_by UUID REFERENCES user_profiles(id),
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    owc_earned INTEGER DEFAULT 0,
    incidents_handled INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_shift_times CHECK (shift_end > shift_start),
    CONSTRAINT valid_shift_type CHECK (shift_type IN ('regular', 'emergency', 'court', 'special')),
    CONSTRAINT valid_status CHECK (status IN ('scheduled', 'active', 'completed', 'missed', 'cancelled'))
);

-- Officer patrol assignments table
CREATE TABLE IF NOT EXISTS officer_patrols (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    patrol_type VARCHAR(30) NOT NULL, -- 'stream_monitoring', 'marketplace_patrol', 'court_security', 'emergency_response'
    priority_level INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high, 4=critical
    status VARCHAR(20) DEFAULT 'assigned', -- 'assigned', 'in_progress', 'completed', 'cancelled'
    target_id UUID, -- stream_id, user_id, or other target depending on patrol type
    target_type VARCHAR(20), -- 'stream', 'user', 'marketplace_listing', 'general'
    instructions TEXT,
    assigned_by UUID REFERENCES user_profiles(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    findings TEXT, -- What the officer found/reported
    actions_taken TEXT, -- What actions were taken
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Internal officer chat messages table
CREATE TABLE IF NOT EXISTS officer_chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    message_type VARCHAR(20) DEFAULT 'message', -- 'message', 'system', 'alert', 'patrol_report'
    content TEXT NOT NULL,
    priority VARCHAR(10) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    reply_to UUID REFERENCES officer_chat_messages(id), -- For threading
    metadata JSONB DEFAULT '{}', -- Additional data like patrol reports, alerts, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creator panic alerts table
CREATE TABLE IF NOT EXISTS creator_panic_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    stream_id UUID REFERENCES streams(id),
    alert_type VARCHAR(30) NOT NULL, -- 'harassment', 'threat', 'technical_issue', 'medical_emergency', 'general'
    severity VARCHAR(10) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    description TEXT,
    location_details TEXT, -- Where the creator is, contact info, etc.
    immediate_actions_taken TEXT,
    assigned_officer_id UUID REFERENCES user_profiles(id),
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'assigned', 'resolved', 'false_alarm'
    response_time_seconds INTEGER,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Officer availability/status tracking
CREATE TABLE IF NOT EXISTS officer_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    current_status VARCHAR(20) DEFAULT 'offline', -- 'offline', 'available', 'busy', 'on_break', 'emergency_response'
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    current_shift_id UUID REFERENCES officer_shifts(id),
    current_patrol_id UUID REFERENCES officer_patrols(id),
    location_area VARCHAR(50), -- Current patrol area or location
    is_emergency_ready BOOLEAN DEFAULT TRUE,
    status_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_officer_status UNIQUE (officer_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_officer_shifts_officer_id ON officer_shifts(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_shifts_status ON officer_shifts(status);
CREATE INDEX IF NOT EXISTS idx_officer_shifts_shift_start ON officer_shifts(shift_start);
CREATE INDEX IF NOT EXISTS idx_officer_shifts_patrol_area ON officer_shifts(patrol_area);

CREATE INDEX IF NOT EXISTS idx_officer_patrols_officer_id ON officer_patrols(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_patrols_status ON officer_patrols(status);
CREATE INDEX IF NOT EXISTS idx_officer_patrols_priority ON officer_patrols(priority_level DESC);
CREATE INDEX IF NOT EXISTS idx_officer_patrols_type ON officer_patrols(patrol_type);

CREATE INDEX IF NOT EXISTS idx_officer_chat_sender ON officer_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_officer_chat_created_at ON officer_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_officer_chat_priority ON officer_chat_messages(priority);
CREATE INDEX IF NOT EXISTS idx_officer_chat_reply_to ON officer_chat_messages(reply_to);

CREATE INDEX IF NOT EXISTS idx_creator_panic_alerts_creator ON creator_panic_alerts(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_panic_alerts_status ON creator_panic_alerts(status);
CREATE INDEX IF NOT EXISTS idx_creator_panic_alerts_severity ON creator_panic_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_creator_panic_alerts_created_at ON creator_panic_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_officer_status_officer_id ON officer_status(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_status_current_status ON officer_status(current_status);

-- RLS Policies
ALTER TABLE officer_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE officer_patrols ENABLE ROW LEVEL SECURITY;
ALTER TABLE officer_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_panic_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE officer_status ENABLE ROW LEVEL SECURITY;

-- Officer shifts policies (officers can see their own, admins can see all)
CREATE POLICY "Officer shifts access" ON officer_shifts
    FOR SELECT USING (
        officer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

CREATE POLICY "Officer shifts admin write" ON officer_shifts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

-- Officer patrols policies
CREATE POLICY "Officer patrols access" ON officer_patrols
    FOR SELECT USING (
        officer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

CREATE POLICY "Officer patrols write" ON officer_patrols
    FOR ALL USING (
        officer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

-- Officer chat policies (officers and admins only)
CREATE POLICY "Officer chat access" ON officer_chat_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

-- Creator panic alerts policies (officers/admins can see all, creators can see their own)
CREATE POLICY "Creator panic alerts access" ON creator_panic_alerts
    FOR SELECT USING (
        creator_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

CREATE POLICY "Creator panic alerts creator insert" ON creator_panic_alerts
    FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creator panic alerts officer update" ON creator_panic_alerts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

-- Officer status policies
CREATE POLICY "Officer status access" ON officer_status
    FOR SELECT USING (
        officer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

CREATE POLICY "Officer status write" ON officer_status
    FOR ALL USING (officer_id = auth.uid());

-- Functions for officer operations
CREATE OR REPLACE FUNCTION create_officer_shift(
    p_officer_id UUID,
    p_shift_start TIMESTAMPTZ,
    p_shift_end TIMESTAMPTZ,
    p_shift_type VARCHAR(20) DEFAULT 'regular',
    p_patrol_area VARCHAR(50) DEFAULT NULL,
    p_assigned_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    shift_id UUID;
BEGIN
    INSERT INTO officer_shifts (
        officer_id, shift_start, shift_end, shift_type, patrol_area, assigned_by
    ) VALUES (
        p_officer_id, p_shift_start, p_shift_end, p_shift_type, p_patrol_area, p_assigned_by
    ) RETURNING id INTO shift_id;

    -- Update officer status
    INSERT INTO officer_status (officer_id, current_status, current_shift_id)
    VALUES (p_officer_id, 'scheduled', shift_id)
    ON CONFLICT (officer_id) DO UPDATE SET
        current_status = 'scheduled',
        current_shift_id = shift_id,
        updated_at = NOW();

    RETURN shift_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION assign_officer_patrol(
    p_officer_id UUID,
    p_patrol_type VARCHAR(30),
    p_priority_level INTEGER DEFAULT 1,
    p_target_id UUID DEFAULT NULL,
    p_target_type VARCHAR(20) DEFAULT NULL,
    p_instructions TEXT DEFAULT NULL,
    p_assigned_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    patrol_id UUID;
BEGIN
    INSERT INTO officer_patrols (
        officer_id, patrol_type, priority_level, target_id, target_type,
        instructions, assigned_by
    ) VALUES (
        p_officer_id, p_patrol_type, p_priority_level, p_target_id, p_target_type,
        p_instructions, p_assigned_by
    ) RETURNING id INTO patrol_id;

    -- Update officer status
    UPDATE officer_status
    SET current_patrol_id = patrol_id,
        current_status = 'busy',
        updated_at = NOW()
    WHERE officer_id = p_officer_id;

    -- Send notification to officer
    PERFORM send_notification(
        p_officer_id,
        'patrol_assigned',
        'New Patrol Assignment',
        'You have been assigned a new patrol: ' || p_patrol_type,
        jsonb_build_object('patrol_id', patrol_id, 'patrol_type', p_patrol_type)
    );

    RETURN patrol_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_creator_panic_alert(
    p_creator_id UUID,
    p_stream_id UUID DEFAULT NULL,
    p_alert_type VARCHAR(30),
    p_severity VARCHAR(10) DEFAULT 'medium',
    p_description TEXT DEFAULT NULL,
    p_location_details TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    alert_id UUID;
    available_officer_id UUID;
BEGIN
    -- Insert panic alert
    INSERT INTO creator_panic_alerts (
        creator_id, stream_id, alert_type, severity, description, location_details
    ) VALUES (
        p_creator_id, p_stream_id, p_alert_type, p_severity, p_description, p_location_details
    ) RETURNING id INTO alert_id;

    -- Find available officer (prioritize those on emergency response or available)
    SELECT officer_id INTO available_officer_id
    FROM officer_status
    WHERE current_status IN ('available', 'emergency_response')
      AND is_emergency_ready = TRUE
    ORDER BY last_seen DESC
    LIMIT 1;

    -- If no available officer, assign to any officer
    IF available_officer_id IS NULL THEN
        SELECT officer_id INTO available_officer_id
        FROM officer_status
        WHERE current_status NOT IN ('offline')
        ORDER BY last_seen DESC
        LIMIT 1;
    END IF;

    -- Assign officer if found
    IF available_officer_id IS NOT NULL THEN
        UPDATE creator_panic_alerts
        SET assigned_officer_id = available_officer_id,
            status = 'assigned'
        WHERE id = alert_id;

        -- Update officer status to emergency response
        UPDATE officer_status
        SET current_status = 'emergency_response',
            updated_at = NOW()
        WHERE officer_id = available_officer_id;

        -- Send urgent notification to assigned officer
        PERFORM send_notification(
            available_officer_id,
            'panic_alert',
            '🚨 CREATOR PANIC ALERT - IMMEDIATE RESPONSE REQUIRED',
            'A creator has triggered a panic alert: ' || p_alert_type,
            jsonb_build_object(
                'alert_id', alert_id,
                'alert_type', p_alert_type,
                'severity', p_severity,
                'creator_id', p_creator_id,
                'stream_id', p_stream_id
            )
        );
    END IF;

    -- Log system event
    PERFORM log_system_event(
        'officer',
        'panic_alert',
        CASE WHEN p_severity = 'critical' THEN 'critical' ELSE 'error' END,
        'Creator panic alert triggered: ' || p_alert_type,
        p_description,
        jsonb_build_object(
            'alert_id', alert_id,
            'alert_type', p_alert_type,
            'severity', p_severity,
            'assigned_officer', available_officer_id
        ),
        p_creator_id
    );

    RETURN alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION send_officer_chat_message(
    p_sender_id UUID,
    p_content TEXT,
    p_message_type VARCHAR(20) DEFAULT 'message',
    p_priority VARCHAR(10) DEFAULT 'normal',
    p_reply_to UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    message_id UUID;
BEGIN
    INSERT INTO officer_chat_messages (
        sender_id, message_type, content, priority, reply_to, metadata
    ) VALUES (
        p_sender_id, p_message_type, p_content, p_priority, p_reply_to, p_metadata
    ) RETURNING id INTO message_id;

    RETURN message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_officer_status(
    p_officer_id UUID,
    p_status VARCHAR(20),
    p_location_area VARCHAR(50) DEFAULT NULL,
    p_status_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO officer_status (
        officer_id, current_status, location_area, status_message
    ) VALUES (
        p_officer_id, p_status, p_location_area, p_status_message
    ) ON CONFLICT (officer_id) DO UPDATE SET
        current_status = p_status,
        location_area = COALESCE(p_location_area, officer_status.location_area),
        status_message = COALESCE(p_status_message, officer_status.status_message),
        last_seen = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;