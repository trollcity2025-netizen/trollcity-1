-- City Control Center System
-- Global event logging, system health monitoring, and control center features

-- Global event log table for system-wide events
CREATE TABLE IF NOT EXISTS event_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- 'system', 'user', 'court', 'stream', 'officer', 'marketplace', 'error'
    event_subtype VARCHAR(50), -- More specific categorization
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
    title VARCHAR(200) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    user_id UUID REFERENCES user_profiles(id),
    admin_id UUID REFERENCES user_profiles(id), -- Admin who triggered or resolved
    ip_address INET,
    user_agent TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System health monitoring table
CREATE TABLE IF NOT EXISTS system_health (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL, -- 'paypal', 'supabase', 'livekit', 'database', 'api'
    status VARCHAR(20) DEFAULT 'unknown', -- 'healthy', 'degraded', 'down', 'unknown'
    last_check TIMESTAMPTZ DEFAULT NOW(),
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Global system settings for emergency controls
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB DEFAULT '{}',
    description TEXT,
    is_emergency_control BOOLEAN DEFAULT FALSE,
    last_modified_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description, is_emergency_control) VALUES
('payouts_enabled', '{"enabled": true}', 'Controls whether payouts are processed', true),
('new_streams_enabled', '{"enabled": true}', 'Controls whether new streams can be started', true),
('global_chat_enabled', '{"enabled": true}', 'Controls global chat functionality', true),
('court_sessions_enabled', '{"enabled": true}', 'Controls whether court sessions can be started', true),
('maintenance_mode', '{"enabled": false}', 'Global maintenance mode', true),
('emergency_stop', '{"active": false}', 'Emergency stop for all operations', true)
ON CONFLICT (setting_key) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_log_event_type ON event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_log_created_at ON event_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_severity ON event_log(severity);
CREATE INDEX IF NOT EXISTS idx_event_log_user_id ON event_log(user_id);
CREATE INDEX IF NOT EXISTS idx_system_health_service_name ON system_health(service_name);
CREATE INDEX IF NOT EXISTS idx_system_health_last_check ON system_health(last_check DESC);

-- RLS Policies
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Event log policies (admins and officers can read, only admins can write)
CREATE POLICY "Event log read access" ON event_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true OR is_troll_officer = true)
        )
    );

CREATE POLICY "Event log admin write" ON event_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

-- System health policies (read-only for admins/officers)
CREATE POLICY "System health read access" ON system_health
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true OR is_troll_officer = true)
        )
    );

-- System settings policies (admins only)
CREATE POLICY "System settings access" ON system_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

-- Functions for system monitoring
CREATE OR REPLACE FUNCTION log_system_event(
    p_event_type VARCHAR(50),
    p_event_subtype VARCHAR(50) DEFAULT NULL,
    p_severity VARCHAR(20) DEFAULT 'info',
    p_title VARCHAR(200),
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_user_id UUID DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO event_log (
        event_type, event_subtype, severity, title, description,
        metadata, user_id, ip_address, user_agent
    ) VALUES (
        p_event_type, p_event_subtype, p_severity, p_title, p_description,
        p_metadata, p_user_id, p_ip_address, p_user_agent
    ) RETURNING id INTO event_id;

    RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update system health
CREATE OR REPLACE FUNCTION update_system_health(
    p_service_name VARCHAR(50),
    p_status VARCHAR(20),
    p_response_time_ms INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO system_health (
        service_name, status, response_time_ms, error_message, metadata
    ) VALUES (
        p_service_name, p_status, p_response_time_ms, p_error_message, p_metadata
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get system setting
CREATE OR REPLACE FUNCTION get_system_setting(p_setting_key VARCHAR(100)) RETURNS JSONB AS $$
DECLARE
    setting_value JSONB;
BEGIN
    SELECT setting_value INTO setting_value
    FROM system_settings
    WHERE setting_key = p_setting_key;

    RETURN COALESCE(setting_value, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update system setting
CREATE OR REPLACE FUNCTION update_system_setting(
    p_setting_key VARCHAR(100),
    p_setting_value JSONB,
    p_admin_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE system_settings
    SET setting_value = p_setting_value,
        last_modified_by = p_admin_id,
        updated_at = NOW()
    WHERE setting_key = p_setting_key;

    -- Log the setting change
    PERFORM log_system_event(
        'system',
        'setting_change',
        'info',
        'System setting updated: ' || p_setting_key,
        'Setting changed by admin',
        jsonb_build_object('setting_key', p_setting_key, 'new_value', p_setting_value),
        p_admin_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if emergency control is active
CREATE OR REPLACE FUNCTION is_emergency_control_active(p_control_name VARCHAR(100)) RETURNS BOOLEAN AS $$
DECLARE
    setting_value JSONB;
    is_active BOOLEAN := FALSE;
BEGIN
    SELECT setting_value INTO setting_value
    FROM system_settings
    WHERE setting_key = p_control_name AND is_emergency_control = TRUE;

    IF setting_value IS NOT NULL THEN
        -- Check different possible structures
        IF setting_value ? 'enabled' THEN
            is_active := (setting_value->>'enabled')::boolean;
        ELSIF setting_value ? 'active' THEN
            is_active := (setting_value->>'active')::boolean;
        END IF;
    END IF;

    RETURN is_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;