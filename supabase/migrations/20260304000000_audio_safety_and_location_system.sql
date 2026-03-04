-- ============================================================
-- TROLL CITY BACKGROUND AUDIO SAFETY & LOCATION SYSTEM
-- ============================================================

-- ============================================================
-- 1. SAFETY ALERTS TABLE
-- Stores only triggered phrases - NEVER full transcripts
-- ============================================================

CREATE TABLE IF NOT EXISTS safety_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('SELF_HARM', 'THREAT', 'VIOLENCE', 'ABUSE')),
    trigger_phrase VARCHAR(255) NOT NULL,
    audio_chunk_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    alert_level INTEGER DEFAULT 1 CHECK (alert_level IN (1, 2, 3)),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_taken VARCHAR(100),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for safety_alerts
CREATE INDEX IF NOT EXISTS idx_safety_alerts_stream ON safety_alerts(stream_id);
CREATE INDEX IF NOT EXISTS idx_safety_alerts_user ON safety_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_alerts_type ON safety_alerts(trigger_type);
CREATE INDEX IF NOT EXISTS idx_safety_alerts_level ON safety_alerts(alert_level);
CREATE INDEX IF NOT EXISTS idx_safety_alerts_created ON safety_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_safety_alerts_reviewed ON safety_alerts(reviewed_by) WHERE reviewed_by IS NULL;

-- RLS Policies for safety_alerts
ALTER TABLE safety_alerts ENABLE ROW LEVEL SECURITY;

-- Only officers and admins can view safety alerts
CREATE POLICY "Officers can view safety alerts"
ON safety_alerts FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'troll_officer', 'lead_troll_officer', 'moderator', 'super_admin', 'platform_admin')
    )
);

-- Only officers can update safety alerts
CREATE POLICY "Officers can update safety alerts"
ON safety_alerts FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'troll_officer', 'lead_troll_officer', 'moderator', 'super_admin', 'platform_admin')
    )
);

-- System can insert safety alerts (via service role)
CREATE POLICY "System can insert safety alerts"
ON safety_alerts FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'troll_officer', 'lead_troll_officer', 'moderator', 'super_admin', 'platform_admin', 'service_role')
    )
);

COMMENT ON TABLE safety_alerts IS 'Stores safety alerts triggered by audio monitoring. NEVER stores full transcripts - only trigger phrases.';

-- ============================================================
-- 2. EXTEND EXISTING USER IP TRACKING TABLE
-- The user_ip_tracking table already exists, add geolocation columns
-- ============================================================

-- Add geolocation columns to existing user_ip_tracking table
DO $$
BEGIN
    -- Check if table exists and add columns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_ip_tracking') THEN
        ALTER TABLE user_ip_tracking
        ADD COLUMN IF NOT EXISTS city VARCHAR(100),
        ADD COLUMN IF NOT EXISTS state VARCHAR(100),
        ADD COLUMN IF NOT EXISTS region VARCHAR(100),
        ADD COLUMN IF NOT EXISTS country VARCHAR(100),
        ADD COLUMN IF NOT EXISTS country_code VARCHAR(10),
        ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
        ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
        ADD COLUMN IF NOT EXISTS isp VARCHAR(255),
        ADD COLUMN IF NOT EXISTS organization VARCHAR(255),
        ADD COLUMN IF NOT EXISTS timezone VARCHAR(100),
        ADD COLUMN IF NOT EXISTS geolocation_source VARCHAR(50) DEFAULT 'login' CHECK (geolocation_source IN ('login', 'signup', 'manual_lookup'));
    END IF;
END $$;

-- Add indexes for geolocation queries
CREATE INDEX IF NOT EXISTS idx_user_ip_tracking_city ON user_ip_tracking(city);
CREATE INDEX IF NOT EXISTS idx_user_ip_tracking_country ON user_ip_tracking(country);

-- Update RLS Policies for user_ip_tracking - RESTRICTED TO ADMINS ONLY
-- First drop existing policies that might allow broader access
DROP POLICY IF EXISTS "auth_select_own" ON user_ip_tracking;
DROP POLICY IF EXISTS "Allow select for service role" ON user_ip_tracking;

-- Create restricted policy - Only super admins and platform admins
CREATE POLICY "Only super admins can view locations"
ON user_ip_tracking FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'platform_admin')
    )
);

COMMENT ON TABLE user_ip_tracking IS 'Stores IP addresses and approximate geolocation. VISIBLE ONLY TO SUPER ADMINS for emergency response.';

-- ============================================================
-- 3. ADMIN AUDIT LOGS TABLE
-- Tracks all sensitive admin actions
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL CHECK (action_type IN (
        'safety_alert_generated',
        'safety_alert_reviewed',
        'admin_location_lookup',
        'emergency_info_accessed',
        'stream_ended_safety',
        'warning_issued_safety',
        'troll_court_referral',
        'user_jailed_safety'
    )),
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    target_stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for admin_audit_logs
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user ON admin_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at);

-- RLS Policies for admin_audit_logs
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Only super admins can view audit logs"
ON admin_audit_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'platform_admin')
    )
);

-- System and admins can insert audit logs
CREATE POLICY "Admins can insert audit logs"
ON admin_audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

COMMENT ON TABLE admin_audit_logs IS 'Audit trail for sensitive admin actions including safety alerts and location lookups.';

-- ============================================================
-- 4. STREAM AUDIO MONITORING STATUS
-- Tracks which streams are being monitored
-- ============================================================

CREATE TABLE IF NOT EXISTS stream_audio_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_monitored BOOLEAN DEFAULT true,
    monitoring_started_at TIMESTAMP DEFAULT NOW(),
    monitoring_ended_at TIMESTAMP,
    total_triggers INTEGER DEFAULT 0,
    last_trigger_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stream_audio_monitoring_stream ON stream_audio_monitoring(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_audio_monitoring_user ON stream_audio_monitoring(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_audio_monitoring_active ON stream_audio_monitoring(is_monitored) WHERE is_monitored = true;

-- RLS Policies
ALTER TABLE stream_audio_monitoring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Officers can view monitoring status"
ON stream_audio_monitoring FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'troll_officer', 'lead_troll_officer', 'moderator', 'super_admin', 'platform_admin')
    )
);

CREATE POLICY "System can manage monitoring"
ON stream_audio_monitoring FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================
-- 5. HELPER FUNCTIONS
-- ============================================================

-- Function to log admin audit events
CREATE OR REPLACE FUNCTION log_admin_audit(
    p_action_type VARCHAR,
    p_target_user_id UUID DEFAULT NULL,
    p_target_stream_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_ip_address INET;
BEGIN
    -- Get IP from current connection (if available)
    BEGIN
        v_ip_address := inet_client_addr();
    EXCEPTION WHEN OTHERS THEN
        v_ip_address := NULL;
    END;

    INSERT INTO admin_audit_logs (
        admin_id, 
        action_type, 
        target_user_id, 
        target_stream_id, 
        details, 
        ip_address,
        user_agent
    )
    VALUES (
        auth.uid(), 
        p_action_type, 
        p_target_user_id, 
        p_target_stream_id, 
        p_details,
        v_ip_address,
        current_setting('request.headers', true)::jsonb->>'user-agent'
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create safety alert with escalation
CREATE OR REPLACE FUNCTION create_safety_alert(
    p_stream_id UUID,
    p_user_id UUID,
    p_trigger_type VARCHAR,
    p_trigger_phrase VARCHAR
)
RETURNS TABLE(alert_id UUID, alert_level INTEGER, total_triggers INTEGER) AS $$
DECLARE
    v_alert_id UUID;
    v_alert_level INTEGER;
    v_total_triggers INTEGER;
    v_existing_count INTEGER;
BEGIN
    -- Count existing triggers for this stream in last 24 hours
    SELECT COUNT(*) INTO v_existing_count
    FROM safety_alerts
    WHERE stream_id = p_stream_id
    AND created_at > NOW() - INTERVAL '24 hours';
    
    -- Determine alert level based on trigger count
    v_alert_level := CASE
        WHEN v_existing_count >= 4 THEN 3  -- 5+ triggers = high priority
        WHEN v_existing_count >= 2 THEN 2  -- 3-4 triggers = flagged
        ELSE 1                              -- 1-2 triggers = notification
    END;
    
    -- Insert the alert
    INSERT INTO safety_alerts (
        stream_id,
        user_id,
        trigger_type,
        trigger_phrase,
        alert_level
    )
    VALUES (
        p_stream_id,
        p_user_id,
        p_trigger_type,
        p_trigger_phrase,
        v_alert_level
    )
    RETURNING id INTO v_alert_id;
    
    -- Update total trigger count
    v_total_triggers := v_existing_count + 1;
    
    -- Update stream monitoring status
    INSERT INTO stream_audio_monitoring (stream_id, user_id, total_triggers, last_trigger_at)
    VALUES (p_stream_id, p_user_id, v_total_triggers, NOW())
    ON CONFLICT (stream_id) 
    DO UPDATE SET 
        total_triggers = stream_audio_monitoring.total_triggers + 1,
        last_trigger_at = NOW(),
        updated_at = NOW();
    
    -- Log the audit event
    PERFORM log_admin_audit(
        'safety_alert_generated',
        p_user_id,
        p_stream_id,
        jsonb_build_object(
            'trigger_type', p_trigger_type,
            'trigger_phrase', p_trigger_phrase,
            'alert_level', v_alert_level,
            'total_triggers', v_total_triggers
        )
    );
    
    RETURN QUERY SELECT v_alert_id, v_alert_level, v_total_triggers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to store user geolocation from IP
CREATE OR REPLACE FUNCTION store_user_geolocation(
    p_user_id UUID,
    p_ip_address INET,
    p_city VARCHAR DEFAULT NULL,
    p_state VARCHAR DEFAULT NULL,
    p_region VARCHAR DEFAULT NULL,
    p_country VARCHAR DEFAULT NULL,
    p_country_code VARCHAR DEFAULT NULL,
    p_latitude DECIMAL DEFAULT NULL,
    p_longitude DECIMAL DEFAULT NULL,
    p_isp VARCHAR DEFAULT NULL,
    p_organization VARCHAR DEFAULT NULL,
    p_timezone VARCHAR DEFAULT NULL,
    p_source VARCHAR DEFAULT 'login'
)
RETURNS UUID AS $$
DECLARE
    v_location_id UUID;
BEGIN
    -- Update the most recent IP tracking record for this user
    UPDATE user_ip_tracking
    SET 
        city = p_city,
        state = p_state,
        region = p_region,
        country = p_country,
        country_code = p_country_code,
        latitude = p_latitude,
        longitude = p_longitude,
        isp = p_isp,
        organization = p_organization,
        timezone = p_timezone,
        geolocation_source = p_source
    WHERE id = (
        SELECT id FROM user_ip_tracking 
        WHERE user_id = p_user_id 
        ORDER BY created_at DESC 
        LIMIT 1
    )
    RETURNING id INTO v_location_id;
    
    -- If no record was updated, return null
    RETURN v_location_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to lookup user location (with audit logging)
CREATE OR REPLACE FUNCTION lookup_user_location(
    p_user_id UUID,
    p_search_type VARCHAR DEFAULT 'user_id'
)
RETURNS TABLE(
    username VARCHAR,
    ip_address INET,
    city VARCHAR,
    state VARCHAR,
    country VARCHAR,
    isp VARCHAR,
    last_login TIMESTAMP
) AS $$
BEGIN
    -- Log the lookup
    PERFORM log_admin_audit(
        'admin_location_lookup',
        p_user_id,
        NULL,
        jsonb_build_object('search_type', p_search_type)
    );
    
    RETURN QUERY
    SELECT 
        up.username,
        uit.ip_address,
        uit.city,
        uit.state,
        uit.country,
        uit.isp,
        uit.created_at as last_login
    FROM user_ip_tracking uit
    JOIN user_profiles up ON uit.user_id = up.id
    WHERE uit.user_id = p_user_id
    ORDER BY uit.created_at DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get emergency info for a user
CREATE OR REPLACE FUNCTION get_emergency_user_info(
    p_user_id UUID
)
RETURNS TABLE(
    user_id UUID,
    username VARCHAR,
    email VARCHAR,
    latest_ip INET,
    city VARCHAR,
    state VARCHAR,
    country VARCHAR,
    isp VARCHAR,
    last_seen TIMESTAMP
) AS $$
BEGIN
    -- Log the emergency access
    PERFORM log_admin_audit(
        'emergency_info_accessed',
        p_user_id,
        NULL,
        jsonb_build_object('reason', 'emergency_response')
    );
    
    RETURN QUERY
    SELECT 
        up.id as user_id,
        up.username,
        au.email,
        uit.ip_address as latest_ip,
        uit.city,
        uit.state,
        uit.country,
        uit.isp,
        uit.created_at as last_seen
    FROM user_profiles up
    JOIN auth.users au ON up.id = au.id
    LEFT JOIN LATERAL (
        SELECT * FROM user_ip_tracking 
        WHERE user_id = up.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) uit ON true
    WHERE up.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to review a safety alert
CREATE OR REPLACE FUNCTION review_safety_alert(
    p_alert_id UUID,
    p_action_taken VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    v_alert RECORD;
BEGIN
    -- Get alert details
    SELECT * INTO v_alert FROM safety_alerts WHERE id = p_alert_id;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Update the alert
    UPDATE safety_alerts
    SET 
        reviewed_by = auth.uid(),
        action_taken = p_action_taken,
        reviewed_at = NOW()
    WHERE id = p_alert_id;
    
    -- Log the review
    PERFORM log_admin_audit(
        'safety_alert_reviewed',
        v_alert.user_id,
        v_alert.stream_id,
        jsonb_build_object(
            'alert_id', p_alert_id,
            'trigger_type', v_alert.trigger_type,
            'action_taken', p_action_taken
        )
    );
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. VIEWS FOR DASHBOARDS
-- ============================================================

-- View for active safety alerts (Officer Dashboard)
CREATE OR REPLACE VIEW active_safety_alerts_view AS
SELECT 
    sa.id,
    sa.stream_id,
    sa.user_id,
    up.username as user_username,
    s.title as stream_title,
    sa.trigger_type,
    sa.trigger_phrase,
    sa.alert_level,
    sa.audio_chunk_timestamp,
    sa.created_at,
    sa.reviewed_by,
    reviewer.username as reviewer_username,
    sa.action_taken,
    sa.reviewed_at,
    sam.total_triggers,
    CASE 
        WHEN sa.alert_level = 3 THEN 'HIGH PRIORITY'
        WHEN sa.alert_level = 2 THEN 'FLAGGED'
        ELSE 'NOTIFICATION'
    END as alert_status
FROM safety_alerts sa
JOIN user_profiles up ON sa.user_id = up.id
LEFT JOIN streams s ON sa.stream_id = s.id
LEFT JOIN user_profiles reviewer ON sa.reviewed_by = reviewer.id
LEFT JOIN stream_audio_monitoring sam ON sa.stream_id = sam.stream_id
WHERE sa.reviewed_by IS NULL
ORDER BY sa.alert_level DESC, sa.created_at DESC;

-- View for user location intelligence (Admin Dashboard)
CREATE OR REPLACE VIEW user_location_intelligence_view AS
SELECT 
    up.id as user_id,
    up.username,
    up.role,
    au.email,
    uit.ip_address,
    uit.city,
    uit.state,
    uit.region,
    uit.country,
    uit.country_code,
    uit.latitude,
    uit.longitude,
    uit.isp,
    uit.organization,
    uit.timezone,
    uit.geolocation_source as source,
    uit.created_at as last_seen
FROM user_ip_tracking uit
JOIN user_profiles up ON uit.user_id = up.id
JOIN auth.users au ON up.id = au.id
ORDER BY uit.created_at DESC;

-- View for stream monitoring status
CREATE OR REPLACE VIEW stream_monitoring_status_view AS
SELECT 
    s.id as stream_id,
    s.title,
    s.category,
    up.id as user_id,
    up.username as broadcaster_name,
    s.is_live,
    s.current_viewers,
    sam.is_monitored,
    sam.monitoring_started_at,
    sam.total_triggers,
    sam.last_trigger_at,
    (SELECT COUNT(*) FROM safety_alerts 
     WHERE stream_id = s.id 
     AND reviewed_by IS NULL) as pending_alerts,
    (SELECT MAX(alert_level) FROM safety_alerts 
     WHERE stream_id = s.id 
     AND created_at > NOW() - INTERVAL '24 hours') as highest_alert_level
FROM streams s
JOIN user_profiles up ON s.user_id = up.id
LEFT JOIN stream_audio_monitoring sam ON s.id = sam.stream_id
WHERE s.is_live = true;

-- View for audit log summary
CREATE OR REPLACE VIEW admin_audit_summary_view AS
SELECT 
    aal.id,
    aal.admin_id,
    admin.username as admin_username,
    aal.action_type,
    aal.target_user_id,
    target.username as target_username,
    aal.target_stream_id,
    s.title as stream_title,
    aal.details,
    aal.ip_address,
    aal.created_at
FROM admin_audit_logs aal
LEFT JOIN user_profiles admin ON aal.admin_id = admin.id
LEFT JOIN user_profiles target ON aal.target_user_id = target.id
LEFT JOIN streams s ON aal.target_stream_id = s.id
ORDER BY aal.created_at DESC;

-- ============================================================
-- 7. REALTIME SUBSCRIPTIONS
-- ============================================================

-- Enable realtime for safety alerts
ALTER PUBLICATION supabase_realtime ADD TABLE safety_alerts;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
