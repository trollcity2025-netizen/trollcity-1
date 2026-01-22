-- Court Dockets Table
CREATE TABLE IF NOT EXISTS public.court_dockets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_date DATE NOT NULL,
    max_cases INTEGER DEFAULT 20,
    status TEXT DEFAULT 'open', -- open, full, closed, completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(court_date)
);

-- Court Cases Table
CREATE TABLE IF NOT EXISTS public.court_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docket_id UUID REFERENCES public.court_dockets(id),
    defendant_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    plaintiff_id UUID REFERENCES public.user_profiles(id), -- Staff who summoned
    reason TEXT NOT NULL,
    incident_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending', -- pending, warrant_issued, resolved, extended, dismissed
    warrant_active BOOLEAN DEFAULT FALSE,
    users_involved TEXT, -- usernames involved
    judgment TEXT, -- Judge's decision
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add warrant flag to user_profiles for fast access check
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS has_active_warrant BOOLEAN DEFAULT FALSE;

-- RLS Policies
ALTER TABLE public.court_dockets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view dockets" ON public.court_dockets FOR SELECT USING (true);
CREATE POLICY "Staff manage dockets" ON public.court_dockets FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge') OR is_admin = true OR is_troll_officer = true))
);

ALTER TABLE public.court_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view cases" ON public.court_cases FOR SELECT USING (true);
CREATE POLICY "Staff manage cases" ON public.court_cases FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge') OR is_admin = true OR is_troll_officer = true))
);

-- Function to systematically generate/get dockets
CREATE OR REPLACE FUNCTION public.get_or_create_next_docket()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_docket_id UUID;
    v_date DATE;
    v_count INT;
BEGIN
    -- Find the earliest open docket with space
    SELECT d.id INTO v_docket_id
    FROM public.court_dockets d
    LEFT JOIN public.court_cases c ON c.docket_id = d.id
    WHERE d.status = 'open' AND d.court_date >= CURRENT_DATE
    GROUP BY d.id
    HAVING COUNT(c.id) < d.max_cases
    ORDER BY d.court_date ASC
    LIMIT 1;

    IF v_docket_id IS NOT NULL THEN
        RETURN v_docket_id;
    END IF;

    -- Otherwise, create a new docket for the next available date
    SELECT COALESCE(MAX(court_date), CURRENT_DATE) + 1 INTO v_date FROM public.court_dockets;
    INSERT INTO public.court_dockets (court_date) VALUES (v_date) RETURNING id INTO v_docket_id;
    RETURN v_docket_id;
END;
$$;

-- Fix pitch_contests status check constraint
ALTER TABLE public.pitch_contests DROP CONSTRAINT IF EXISTS pitch_contests_status_check;
ALTER TABLE public.pitch_contests
ADD CONSTRAINT pitch_contests_status_check
CHECK (status IN ('submission', 'voting', 'review', 'completed'));
