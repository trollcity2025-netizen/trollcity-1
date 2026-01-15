-- Troll Court AI Extension Tables

-- 1. AI Messages (Transcript & AI Output)
CREATE TABLE IF NOT EXISTS court_ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL, -- Link to court_cases.id
    agent_role TEXT NOT NULL CHECK (agent_role IN ('Prosecutor', 'Defense', 'Judge', 'User', 'System')),
    message_type TEXT NOT NULL CHECK (message_type IN ('statement', 'objection', 'question', 'contradiction', 'missing_evidence', 'civility_warning', 'chat')),
    content TEXT NOT NULL, -- Readable message
    json_data JSONB DEFAULT '{}'::jsonb, -- Structured output (evidence_ids, confidence, etc.)
    source_event_ids TEXT[] DEFAULT '{}', -- IDs of events that triggered this (e.g. chat msg ids)
    user_id UUID REFERENCES auth.users(id), -- If it's a user message
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Summaries
CREATE TABLE IF NOT EXISTS court_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    role TEXT NOT NULL CHECK (role IN ('Plaintiff', 'Defendant', 'Witness', 'Judge')),
    summary_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AI Feedback on Summaries
CREATE TABLE IF NOT EXISTS court_ai_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    agent_role TEXT NOT NULL CHECK (agent_role IN ('Prosecutor', 'Defense')),
    target_user_id UUID REFERENCES auth.users(id),
    feedback_text TEXT NOT NULL,
    json_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Session State (for AI Listening Mode)
CREATE TABLE IF NOT EXISTS court_session_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL UNIQUE,
    is_live BOOLEAN DEFAULT FALSE,
    started_by UUID REFERENCES auth.users(id),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    
    -- Toggles
    ai_enabled BOOLEAN DEFAULT TRUE,
    prosecutor_enabled BOOLEAN DEFAULT TRUE,
    defense_enabled BOOLEAN DEFAULT TRUE,
    defense_counsel_mode BOOLEAN DEFAULT FALSE, -- If true, AI speaks for defendant
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Rate Limits
CREATE TABLE IF NOT EXISTS court_ai_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    agent_role TEXT NOT NULL,
    interruptions_count INTEGER DEFAULT 0,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    last_interruption_at TIMESTAMPTZ,
    UNIQUE(case_id, agent_role)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_court_ai_messages_case ON court_ai_messages(case_id, created_at);
CREATE INDEX IF NOT EXISTS idx_court_summaries_case ON court_summaries(case_id);
CREATE INDEX IF NOT EXISTS idx_court_ai_feedback_case ON court_ai_feedback(case_id);

-- RLS Policies
ALTER TABLE court_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_session_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Public read, restricted write (simplifying for now, can refine later)
CREATE POLICY "Public read court ai messages" ON court_ai_messages FOR SELECT USING (true);
CREATE POLICY "Authenticated insert court ai messages" ON court_ai_messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Public read court summaries" ON court_summaries FOR SELECT USING (true);
CREATE POLICY "Users manage own summaries" ON court_summaries FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public read ai feedback" ON court_ai_feedback FOR SELECT USING (true);
CREATE POLICY "System insert ai feedback" ON court_ai_feedback FOR INSERT WITH CHECK (true); -- In practice, backend triggers this

CREATE POLICY "Public read session state" ON court_session_state FOR SELECT USING (true);
CREATE POLICY "Admins/Officers manage session state" ON court_session_state FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'troll_officer' OR role = 'lead_troll_officer' OR is_admin = true OR is_troll_officer = true))
);

CREATE POLICY "Public read rate limits" ON court_ai_rate_limits FOR SELECT USING (true);
CREATE POLICY "System manage rate limits" ON court_ai_rate_limits FOR ALL USING (true);
