-- Safety monitoring system database schema

-- Create safety_keywords table for storing dangerous keywords
CREATE TABLE safety_keywords (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    keyword TEXT NOT NULL UNIQUE,
    severity_level INTEGER NOT NULL DEFAULT 1 CHECK (severity_level BETWEEN 1 AND 5),
    category TEXT NOT NULL CHECK (category IN ('self_harm', 'violence', 'substance_abuse', 'harassment', 'other')),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create safety_incidents table for tracking incidents
CREATE TABLE safety_incidents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    detected_keyword_id UUID REFERENCES safety_keywords(id),
    incident_type TEXT NOT NULL CHECK (incident_type IN ('keyword_detected', 'manual_report', 'ai_flagged')),
    severity_level INTEGER NOT NULL CHECK (severity_level BETWEEN 1 AND 5),
    context_text TEXT,
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    location_accuracy DECIMAL(5, 2),
    video_clip_url TEXT,
    video_clip_path TEXT,
    ip_address INET,
    user_agent TEXT,
    is_emergency BOOLEAN DEFAULT false,
    police_notified BOOLEAN DEFAULT false,
    notification_sent BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_location_consent table for tracking location permissions
CREATE TABLE user_location_consent (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    has_consented BOOLEAN DEFAULT false,
    consent_given_at TIMESTAMP WITH TIME ZONE,
    consent_revoked_at TIMESTAMP WITH TIME ZONE,
    consent_version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create safety_notifications table for tracking alerts sent
CREATE TABLE safety_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    incident_id UUID REFERENCES safety_incidents(id) ON DELETE CASCADE,
    notified_user_id UUID REFERENCES auth.users(id),
    notification_type TEXT NOT NULL CHECK (notification_type IN ('troll_officer', 'admin', 'police', 'emergency_contact')),
    notification_method TEXT NOT NULL CHECK (notification_method IN ('email', 'sms', 'push', 'dashboard')),
    recipient_contact TEXT,
    message_content TEXT,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivery_status TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create emergency_contacts table for police/emergency services
CREATE TABLE emergency_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_type TEXT NOT NULL CHECK (contact_type IN ('police', 'mental_health', 'emergency_services')),
    country_code TEXT NOT NULL,
    region TEXT,
    city TEXT,
    phone_number TEXT,
    email TEXT,
    api_endpoint TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default safety keywords
INSERT INTO safety_keywords (keyword, severity_level, category, description) VALUES
-- Self-harm related (severity 5 - highest)
('kill myself', 5, 'self_harm', 'Immediate suicide risk'),
('end my life', 5, 'self_harm', 'Suicide ideation'),
('suicide', 4, 'self_harm', 'Suicide mention'),
('self harm', 4, 'self_harm', 'Self-harm mention'),
('cut myself', 4, 'self_harm', 'Self-injury reference'),

-- Violence related (severity 4-5)
('kill you', 5, 'violence', 'Direct threat'),
('murder', 5, 'violence', 'Homicidal ideation'),
('shoot up', 5, 'violence', 'Mass violence threat'),
('bomb', 4, 'violence', 'Explosive threat'),
('stab', 4, 'violence', 'Violent threat'),

-- Substance abuse (severity 3)
('overdose', 4, 'substance_abuse', 'Drug overdose risk'),
('take pills', 3, 'substance_abuse', 'Potential overdose'),
('drunk driving', 3, 'substance_abuse', 'Dangerous behavior'),

-- Harassment (severity 2-3)
('harass', 2, 'harassment', 'Harassment mention'),
('stalk', 3, 'harassment', 'Stalking behavior'),
('threaten', 3, 'harassment', 'Threatening behavior');

-- Insert sample emergency contacts (these would be real in production)
INSERT INTO emergency_contacts (name, contact_type, country_code, region, phone_number, email) VALUES
('National Suicide Prevention Lifeline', 'mental_health', 'US', 'National', '988', 'support@suicidepreventionlifeline.org'),
('Emergency Services', 'emergency_services', 'US', 'National', '911', ''),
('Crisis Text Line', 'mental_health', 'US', 'National', '741741', 'crisis@crisistextline.org');

-- Enable RLS
ALTER TABLE safety_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_location_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Safety keywords: Admins can manage, all can read active keywords
CREATE POLICY "Admins can manage safety keywords" ON safety_keywords
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Anyone can read active safety keywords" ON safety_keywords
    FOR SELECT USING (is_active = true);

-- Safety incidents: Admins and troll officers can manage
CREATE POLICY "Admins can manage safety incidents" ON safety_incidents
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Troll officers can view safety incidents" ON safety_incidents
    FOR SELECT USING (auth.jwt() ->> 'role' = 'troll_officer');

-- Location consent: Users can manage their own consent
CREATE POLICY "Users can manage their location consent" ON user_location_consent
    FOR ALL USING (auth.uid() = user_id);

-- Safety notifications: Admins can manage
CREATE POLICY "Admins can manage safety notifications" ON safety_notifications
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Emergency contacts: Admins can manage, all can read active contacts
CREATE POLICY "Admins can manage emergency contacts" ON emergency_contacts
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Anyone can read active emergency contacts" ON emergency_contacts
    FOR SELECT USING (is_active = true);

-- Create indexes for performance
CREATE INDEX idx_safety_keywords_active ON safety_keywords(is_active);
CREATE INDEX idx_safety_keywords_severity ON safety_keywords(severity_level);
CREATE INDEX idx_safety_incidents_user_id ON safety_incidents(user_id);
CREATE INDEX idx_safety_incidents_created_at ON safety_incidents(created_at DESC);
CREATE INDEX idx_safety_incidents_is_emergency ON safety_incidents(is_emergency);
CREATE INDEX idx_safety_incidents_resolved ON safety_incidents(resolved_at);
CREATE INDEX idx_user_location_consent_user_id ON user_location_consent(user_id);
CREATE INDEX idx_safety_notifications_incident_id ON safety_notifications(incident_id);
CREATE INDEX idx_safety_notifications_sent ON safety_notifications(is_sent);

-- Create function for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic updated_at
CREATE TRIGGER update_safety_keywords_updated_at BEFORE UPDATE ON safety_keywords
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_safety_incidents_updated_at BEFORE UPDATE ON safety_incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_location_consent_updated_at BEFORE UPDATE ON user_location_consent
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON emergency_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();