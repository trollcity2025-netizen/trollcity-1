-- ============================================================================
-- COURT TABLES - CORRECTED STRUCTURE
-- ============================================================================
-- Tables relate hierarchically:
--   court_dockets
--      │
--      └── court_cases (has docket_id FK)
--              │
--              └── court_summons (has case_id FK)
--
-- court_dockets: id, court_date, max_cases, created_by
-- court_cases: id, docket_id, plaintiff_id, defendant_id
-- court_summons: id, case_id, served_to, served_at
-- ============================================================================

-- ============================================================================
-- 1. COURT DOCKETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.court_dockets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_date DATE NOT NULL,
    max_cases INTEGER DEFAULT 20,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'full', 'closed', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(court_date)
);

-- ============================================================================
-- 2. COURT CASES TABLE (child of court_dockets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.court_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docket_id UUID REFERENCES public.court_dockets(id) ON DELETE CASCADE,
    plaintiff_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    defendant_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_session', 'resolved', 'closed', 'dismissed', 'warrant_issued', 'inactive', 'scheduled', 'appealed')),
    warrant_active BOOLEAN DEFAULT FALSE,
    judgment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. COURT SUMMONS TABLE (child of court_cases)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.court_summons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES public.court_cases(id) ON DELETE CASCADE,
    served_to UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    served_at TIMESTAMPTZ DEFAULT NOW(),
    served_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'served', 'accepted', 'rejected', 'expired')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_court_dockets_date ON public.court_dockets(court_date);
CREATE INDEX IF NOT EXISTS idx_court_dockets_status ON public.court_dockets(status);
CREATE INDEX IF NOT EXISTS idx_court_dockets_created_by ON public.court_dockets(created_by);

CREATE INDEX IF NOT EXISTS idx_court_cases_docket_id ON public.court_cases(docket_id);
CREATE INDEX IF NOT EXISTS idx_court_cases_plaintiff_id ON public.court_cases(plaintiff_id);
CREATE INDEX IF NOT EXISTS idx_court_cases_defendant_id ON public.court_cases(defendant_id);
CREATE INDEX IF NOT EXISTS idx_court_cases_status ON public.court_cases(status);

CREATE INDEX IF NOT EXISTS idx_court_summons_case_id ON public.court_summons(case_id);
CREATE INDEX IF NOT EXISTS idx_court_summons_served_to ON public.court_summons(served_to);
CREATE INDEX IF NOT EXISTS idx_court_summons_status ON public.court_summons(status);

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================
ALTER TABLE public.court_dockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_summons ENABLE ROW LEVEL SECURITY;

-- Court Dockets Policies
CREATE POLICY "Public view dockets" ON public.court_dockets FOR SELECT USING (true);
CREATE POLICY "Staff manage dockets" ON public.court_dockets FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (
            role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge') 
            OR is_admin = true 
            OR is_troll_officer = true
        )
    )
);

-- Court Cases Policies
CREATE POLICY "Public view cases" ON public.court_cases FOR SELECT USING (true);
CREATE POLICY "Participants view own cases" ON public.court_cases FOR SELECT USING (
    auth.uid() = plaintiff_id 
    OR auth.uid() = defendant_id
    OR EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (
            role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge') 
            OR is_admin = true 
            OR is_troll_officer = true
        )
    )
);
CREATE POLICY "Staff manage cases" ON public.court_cases FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (
            role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge') 
            OR is_admin = true 
            OR is_troll_officer = true
        )
    )
);

-- Court Summons Policies
CREATE POLICY "Users view own summons" ON public.court_summons FOR SELECT USING (
    auth.uid() = served_to
    OR auth.uid() = served_by
    OR EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (
            role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge') 
            OR is_admin = true 
            OR is_troll_officer = true
        )
    )
);
CREATE POLICY "Staff manage summons" ON public.court_summons FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (
            role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge') 
            OR is_admin = true 
            OR is_troll_officer = true
        )
    )
);

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to get or create next available docket
CREATE OR REPLACE FUNCTION public.get_or_create_next_docket(p_from_date DATE DEFAULT CURRENT_DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_docket_id UUID;
    v_date DATE;
BEGIN
    -- Find the earliest open docket with space
    SELECT d.id INTO v_docket_id
    FROM public.court_dockets d
    LEFT JOIN public.court_cases c ON c.docket_id = d.id
    WHERE d.status = 'open' AND d.court_date >= p_from_date
    GROUP BY d.id, d.max_cases
    HAVING COUNT(c.id) < d.max_cases
    ORDER BY d.court_date ASC
    LIMIT 1;

    IF v_docket_id IS NOT NULL THEN
        RETURN v_docket_id;
    END IF;

    -- Otherwise, create a new docket for the next available date
    SELECT COALESCE(MAX(court_date), CURRENT_DATE) + 1 INTO v_date FROM public.court_dockets;
    
    INSERT INTO public.court_dockets (court_date, max_cases, status)
    VALUES (v_date, 20, 'open')
    RETURNING id INTO v_docket_id;
    
    RETURN v_docket_id;
END;
$$;

-- Function to create a court case
CREATE OR REPLACE FUNCTION public.create_court_case(
    p_defendant_id UUID,
    p_reason TEXT,
    p_plaintiff_id UUID DEFAULT NULL,
    p_docket_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_docket_id UUID;
    v_case_id UUID;
    v_staff_id UUID;
BEGIN
    v_staff_id := COALESCE(p_plaintiff_id, auth.uid());
    
    -- Resolve docket
    IF p_docket_id IS NOT NULL THEN
        v_docket_id := p_docket_id;
    ELSE
        v_docket_id := public.get_or_create_next_docket(CURRENT_DATE);
    END IF;

    -- Create case
    INSERT INTO public.court_cases (
        docket_id,
        defendant_id,
        plaintiff_id,
        reason,
        status,
        warrant_active
    ) VALUES (
        v_docket_id,
        p_defendant_id,
        v_staff_id,
        p_reason,
        'pending',
        false
    )
    RETURNING id INTO v_case_id;

    -- Update docket status if full
    IF (
        SELECT COUNT(*) FROM public.court_cases 
        WHERE docket_id = v_docket_id
    ) >= (
        SELECT COALESCE(max_cases, 20) FROM public.court_dockets WHERE id = v_docket_id
    ) THEN
        UPDATE public.court_dockets SET status = 'full' WHERE id = v_docket_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'case_id', v_case_id,
        'docket_id', v_docket_id
    );
END;
$$;

-- Function to serve a summons
CREATE OR REPLACE FUNCTION public.serve_summons(
    p_case_id UUID,
    p_served_to UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_summons_id UUID;
    v_staff_id UUID;
BEGIN
    v_staff_id := auth.uid();

    -- Verify case exists
    IF NOT EXISTS (SELECT 1 FROM public.court_cases WHERE id = p_case_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Case not found');
    END IF;

    -- Create summons
    INSERT INTO public.court_summons (
        case_id,
        served_to,
        served_by,
        served_at,
        status,
        notes
    ) VALUES (
        p_case_id,
        p_served_to,
        v_staff_id,
        NOW(),
        'pending',
        p_notes
    )
    RETURNING id INTO v_summons_id;

    RETURN jsonb_build_object(
        'success', true,
        'summons_id', v_summons_id
    );
END;
$$;

-- ============================================================================
-- 7. TRIGGERS FOR UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_court_dockets ON public.court_dockets;
CREATE TRIGGER set_timestamp_court_dockets
    BEFORE UPDATE ON public.court_dockets
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_court_cases ON public.court_cases;
CREATE TRIGGER set_timestamp_court_cases
    BEFORE UPDATE ON public.court_cases
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_court_summons ON public.court_summons;
CREATE TRIGGER set_timestamp_court_summons
    BEFORE UPDATE ON public.court_summons
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();
