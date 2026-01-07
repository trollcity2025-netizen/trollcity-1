-- Troll Court Enhancements
-- Adds Case Templates, Comprehensive Case Management, Evidence, Participants, and Audit Logs

-- 1. Case Templates Table
CREATE TABLE IF NOT EXISTS case_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_type TEXT UNIQUE NOT NULL,
    default_severity TEXT NOT NULL CHECK (default_severity IN ('Low', 'Medium', 'High', 'Critical')),
    required_evidence_types TEXT[] DEFAULT '{}',
    recommended_sanctions JSONB DEFAULT '[]', -- Array of strings/objects
    default_questions TEXT[] DEFAULT '{}',
    suggested_actions JSONB DEFAULT '[]',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Court Cases Table (The central record)
CREATE TABLE IF NOT EXISTS court_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number SERIAL, -- Simple incremental number for display
    title TEXT,
    case_type TEXT NOT NULL REFERENCES case_templates(case_type),
    severity TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'deliberating', 'ruled', 'closed', 'appealed')),
    court_mode TEXT DEFAULT 'Public' CHECK (court_mode IN ('Public', 'Private')),
    
    -- Key Participants (denormalized for easy access, detailed list in case_participants)
    plaintiff_id UUID REFERENCES auth.users(id),
    defendant_id UUID REFERENCES auth.users(id),
    judge_id UUID REFERENCES auth.users(id),
    
    court_session_id UUID REFERENCES court_sessions(id),
    
    -- Ruling / Outcome
    ruling TEXT, -- "Guilty", "Not Guilty", "Dismissed", etc.
    ruling_notes TEXT,
    sanctions_applied JSONB, -- Record of what was actually applied
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 3. Case Participants (Roles & Permissions)
CREATE TABLE IF NOT EXISTS case_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES court_cases(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    role TEXT NOT NULL CHECK (role IN ('Plaintiff', 'Defendant', 'Witness', 'Jury', 'Officer', 'Spectator', 'Judge')),
    permissions JSONB DEFAULT '{}', -- { can_chat: true, can_speak: false, can_upload: true }
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(case_id, user_id)
);

-- 4. Case Evidence
CREATE TABLE IF NOT EXISTS case_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES court_cases(id) ON DELETE CASCADE,
    uploader_id UUID REFERENCES auth.users(id),
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('screenshot', 'video', 'chat_log', 'transaction_log', 'livestream_timestamp', 'profile_link', 'witness_statement', 'other')),
    url TEXT, -- File URL or Link
    description TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES auth.users(id),
    weight TEXT DEFAULT 'Medium' CHECK (weight IN ('Strong', 'Medium', 'Weak')),
    notes TEXT,
    is_locked BOOLEAN DEFAULT FALSE, -- Locked after ruling
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Case Audit Logs (for MAI Timeline & History)
CREATE TABLE IF NOT EXISTS case_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES court_cases(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- "Opened Case", "Submitted Evidence", "Changed Severity", "Ruled"
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE case_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for now, refine later)
CREATE POLICY "Everyone can read case templates" ON case_templates FOR SELECT USING (true);
CREATE POLICY "Everyone can read public cases" ON court_cases FOR SELECT USING (true); -- Refine for Private mode later
CREATE POLICY "Officers can create cases" ON court_cases FOR INSERT WITH CHECK (true); -- Needs stricter check
CREATE POLICY "Participants can read their cases" ON case_participants FOR SELECT USING (true);
CREATE POLICY "Participants can read evidence" ON case_evidence FOR SELECT USING (true);
CREATE POLICY "Everyone can read logs" ON case_audit_logs FOR SELECT USING (true);

-- Functions

-- Seed Data for Case Templates
INSERT INTO case_templates (case_type, default_severity, required_evidence_types, recommended_sanctions, default_questions, suggested_actions) VALUES
('Harassment / Threats', 'High', '{"chat_log", "screenshot"}', '["Temporary Ban (3 days)", "Chat Restriction"]', '{"Did the user continue after being asked to stop?", "Was it a direct threat?"}', '["Mute Participant", "Send Rule Reminder"]'),
('Hate Speech / Discrimination', 'Critical', '{"chat_log", "video"}', '["Permanent Ban", "Temporary Ban (30 days)"]', '{"Was it a slur?", "Was it targeted?"}', '["Kick Participant", "Escalate to Admin"]'),
('Nudity / Sexual Content', 'Critical', '{"screenshot", "video"}', '["Permanent Ban", "Temporary Ban (7 days)"]', '{"Was it explicit?", "Was it accidental?"}', '["Lock Court", "Kick Participant"]'),
('Doxxing / Personal Info', 'Critical', '{"screenshot", "chat_log"}', '["Permanent Ban", "Legal Escalation"]', '{"Was private info shared?", "Was it malicious?"}', '["Escalate to Legal", "Flag as High Priority"]'),
('Scamming / Fraud', 'High', '{"transaction_log", "chat_log"}', '["Permanent Ban", "Coin Fine"]', '{"Was money/coins lost?", "Is there proof of agreement?"}', '["Freeze Assets", "Coin Fine"]'),
('Chargeback / Payment Abuse', 'Critical', '{"transaction_log"}', '["Permanent Ban"]', '{"Did the user chargeback?"}', '["Ban User", "Escalate to Admin"]'),
('Gift Manipulation / Fake gifting', 'Medium', '{"transaction_log"}', '["Gift Ban (7 days)", "Coin Fine"]', '{"Did they promise gifts?", "Did they fake a notification?"}', '["Revoke Gift Privileges"]'),
('Ban Evasion', 'High', '{"profile_link"}', '["Permanent Ban"]', '{"Is this a new account?", "Who was the previous account?"}', '["IP Ban"]'),
('Family War Dispute', 'Medium', '{"chat_log"}', '["Family Penalty", "Warning"]', '{"Who started it?", "Is it disrupting chat?"}', '["Pause Case", "Mute Both Sides"]'),
('Streamer Misconduct', 'High', '{"video", "livestream_timestamp"}', '["Stream Restriction", "Warning"]', '{"Did they break TOS?", "Was it on stream?"}', '["End Stream", "Suspend Channel"]'),
('Officer Misconduct', 'High', '{"chat_log", "witness_statement"}', '["Officer Demotion", "Officer Penalty"]', '{"Did they abuse power?", "Did they ignore protocol?"}', '["Escalate to Lead Officer"]'),
('Appeal Case', 'Medium', '{"profile_link"}', '["Unban", "Reduce Sentence"]', '{"Is there new evidence?", "Has time passed?"}', '["Review Evidence", "Vote"]'),
('Copyright / Content Claim', 'Low', '{"video"}', '["Warning", "Stream Restriction"]', '{"Is it DMCA?", "Is it fair use?"}', '["Takedown Content"]'),
('TrollCourt Civil Case', 'Low', '{"chat_log"}', '["Coin Fine", "Public Apology"]', '{"Is this a user dispute?", "Are coins involved?"}', '["Mediate", "Jury Vote"]'),
('TrollCity Policy Violation', 'Medium', '{"screenshot"}', '["Warning", "Mute"]', '{"Which policy?", "First offense?"}', '["Send Rule Reminder"]')
ON CONFLICT (case_type) DO NOTHING;

-- Function: Create Case (Summon)
CREATE OR REPLACE FUNCTION create_court_case(
    p_case_type TEXT,
    p_plaintiff_id UUID,
    p_defendant_id UUID,
    p_description TEXT DEFAULT NULL,
    p_court_session_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_template case_templates%ROWTYPE;
    v_case_id UUID;
    v_severity TEXT;
BEGIN
    -- Get Template
    SELECT * INTO v_template FROM case_templates WHERE case_type = p_case_type;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid Case Type';
    END IF;
    
    v_severity := v_template.default_severity;

    -- Create Case
    INSERT INTO court_cases (
        case_type, severity, title, plaintiff_id, defendant_id, court_session_id, status
    ) VALUES (
        p_case_type, v_severity, p_case_type || ' Case', p_plaintiff_id, p_defendant_id, p_court_session_id, 'pending'
    ) RETURNING id INTO v_case_id;

    -- Add Participants
    -- Plaintiff
    INSERT INTO case_participants (case_id, user_id, role, permissions)
    VALUES (v_case_id, p_plaintiff_id, 'Plaintiff', '{"can_speak": true, "can_chat": true, "can_upload": true}');

    -- Defendant
    IF p_defendant_id IS NOT NULL THEN
        INSERT INTO case_participants (case_id, user_id, role, permissions)
        VALUES (v_case_id, p_defendant_id, 'Defendant', '{"can_speak": true, "can_chat": true, "can_upload": true}');
    END IF;
    
    -- Log Creation
    INSERT INTO case_audit_logs (case_id, actor_id, action, details)
    VALUES (v_case_id, p_plaintiff_id, 'Case Created', jsonb_build_object('type', p_case_type, 'severity', v_severity));

    RETURN jsonb_build_object('success', true, 'case_id', v_case_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get Case Details (for UI)
CREATE OR REPLACE FUNCTION get_case_details(p_case_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_case court_cases%ROWTYPE;
    v_participants JSONB;
    v_evidence JSONB;
    v_logs JSONB;
    v_template JSONB;
BEGIN
    SELECT * INTO v_case FROM court_cases WHERE id = p_case_id;
    
    SELECT jsonb_agg(to_jsonb(cp.*)) INTO v_participants 
    FROM case_participants cp WHERE case_id = p_case_id;
    
    SELECT jsonb_agg(to_jsonb(ce.*)) INTO v_evidence 
    FROM case_evidence ce WHERE case_id = p_case_id;

    SELECT jsonb_agg(to_jsonb(cal.*)) INTO v_logs
    FROM case_audit_logs cal WHERE case_id = p_case_id ORDER BY created_at DESC;
    
    SELECT to_jsonb(ct.*) INTO v_template
    FROM case_templates ct WHERE case_type = v_case.case_type;

    RETURN jsonb_build_object(
        'case', to_jsonb(v_case),
        'template', v_template,
        'participants', COALESCE(v_participants, '[]'::jsonb),
        'evidence', COALESCE(v_evidence, '[]'::jsonb),
        'logs', COALESCE(v_logs, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
