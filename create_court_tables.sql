-- Add missing columns to court_sessions
ALTER TABLE court_sessions ADD COLUMN IF NOT EXISTS judge_id UUID REFERENCES public.user_profiles(id);
ALTER TABLE court_sessions ADD COLUMN IF NOT EXISTS defendant_id UUID REFERENCES public.user_profiles(id);
ALTER TABLE court_sessions ADD COLUMN IF NOT EXISTS case_type TEXT;
ALTER TABLE court_sessions ADD COLUMN IF NOT EXISTS severity_level INTEGER;
ALTER TABLE court_sessions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE court_sessions ADD COLUMN IF NOT EXISTS max_boxes INTEGER DEFAULT 2;
ALTER TABLE court_sessions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id);

-- Court Cases table
CREATE TABLE IF NOT EXISTS public.court_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    defendant_id UUID REFERENCES public.user_profiles(id),
    accuser_id UUID REFERENCES public.user_profiles(id),
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_session', 'resolved')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    evidence JSONB DEFAULT '[]'::jsonb,
    witnesses JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Court Sentences table
CREATE TABLE IF NOT EXISTS public.court_sentences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES public.court_cases(id) ON DELETE CASCADE,
    defendant_id UUID REFERENCES public.user_profiles(id),
    judge_id UUID REFERENCES public.user_profiles(id),
    sentence_type TEXT NOT NULL,
    details JSONB,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'served', 'appealed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Court Verdicts table
CREATE TABLE IF NOT EXISTS public.court_verdicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES public.court_cases(id) ON DELETE CASCADE,
    verdict TEXT NOT NULL CHECK (verdict IN ('guilty', 'not_guilty')),
    penalty TEXT,
    reasoning TEXT,
    issued_by UUID REFERENCES public.user_profiles(id),
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Court Payments table
CREATE TABLE IF NOT EXISTS public.court_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES public.court_cases(id) ON DELETE CASCADE,
    defendant_id UUID REFERENCES public.user_profiles(id),
    amount INTEGER NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    recipient TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    processed_by UUID REFERENCES public.user_profiles(id),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_court_cases_defendant ON court_cases(defendant_id);
CREATE INDEX IF NOT EXISTS idx_court_cases_accuser ON court_cases(accuser_id);
CREATE INDEX IF NOT EXISTS idx_court_sentences_case ON court_sentences(case_id);
CREATE INDEX IF NOT EXISTS idx_court_sentences_judge ON court_sentences(judge_id);
CREATE INDEX IF NOT EXISTS idx_court_verdicts_case ON court_verdicts(case_id);
CREATE INDEX IF NOT EXISTS idx_court_payments_case ON court_payments(case_id);

-- RLS
ALTER TABLE court_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_verdicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_payments ENABLE ROW LEVEL SECURITY;

-- Court sessions policies - allow session creator to manage their sessions
CREATE POLICY "court_sessions_read" ON court_sessions FOR SELECT USING (true);
CREATE POLICY "court_sessions_write" ON court_sessions FOR ALL USING (
    started_by = auth.uid() OR
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);

-- Policies
CREATE POLICY "court_cases_read" ON court_cases FOR SELECT USING (true);
CREATE POLICY "court_cases_write" ON court_cases FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);

CREATE POLICY "court_sentences_read" ON court_sentences FOR SELECT USING (true);
CREATE POLICY "court_sentences_write" ON court_sentences FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);

CREATE POLICY "court_verdicts_read" ON court_verdicts FOR SELECT USING (true);
CREATE POLICY "court_verdicts_write" ON court_verdicts FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);

CREATE POLICY "court_payments_read" ON court_payments FOR SELECT USING (
    defendant_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);
CREATE POLICY "court_payments_write" ON court_payments FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);

-- Helper function
CREATE OR REPLACE FUNCTION get_user_id_by_username(p_username TEXT)
RETURNS UUID AS $$
DECLARE
    user_id UUID;
BEGIN
    SELECT id INTO user_id
    FROM user_profiles
    WHERE username = p_username
    LIMIT 1;

    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User with username % not found', p_username;
    END IF;

    RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;