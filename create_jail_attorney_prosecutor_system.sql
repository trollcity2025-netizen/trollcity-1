-- ============================================================================
-- JAIL, ATTORNEY, PROSECUTOR AND COURT ENHANCEMENTS
-- ============================================================================

-- ============================================================================
-- 1. ADD COLUMNS TO JAIL TABLE FOR ENHANCED INMATE INFO
-- ============================================================================
ALTER TABLE public.jail 
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS sentence_days INTEGER,
ADD COLUMN IF NOT EXISTS arrest_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS bond_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bond_posted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bond_posted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS message_minutes INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS message_minutes_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster inmate lookups
CREATE INDEX IF NOT EXISTS idx_jail_release_time ON public.jail(release_time);
CREATE INDEX IF NOT EXISTS idx_jail_ip_address ON public.jail(ip_address);

-- ============================================================================
-- 2. ADD PROFILE COLUMNS FOR NEW ROLES
-- ============================================================================
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_attorney BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_prosecutor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS attorney_fee INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS attorney_cases JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_pro_bono BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS badge_attorney TEXT,
ADD COLUMN IF NOT EXISTS badge_prosecutor TEXT,
ADD COLUMN IF NOT EXISTS attorney_cases_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ip_address_history TEXT[] DEFAULT '{}';

-- ============================================================================
-- 3. CREATE ATTORNEY APPLICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attorney_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    attorney_fee INTEGER DEFAULT 0,
    is_pro_bono BOOLEAN DEFAULT FALSE,
    data JSONB DEFAULT '{}'::jsonb,
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attorney_applications_user_id ON public.attorney_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_attorney_applications_status ON public.attorney_applications(status);

-- ============================================================================
-- 4. CREATE PROSECUTOR APPLICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.prosecutor_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    experience TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prosecutor_applications_user_id ON public.prosecutor_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_prosecutor_applications_status ON public.prosecutor_applications(status);

-- ============================================================================
-- 5. CREATE ATTORNEY CASES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attorney_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attorney_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    case_id UUID REFERENCES public.court_cases(id) ON DELETE CASCADE,
    victim_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn')),
    fee_paid INTEGER DEFAULT 0,
    is_pro_bono BOOLEAN DEFAULT FALSE,
    case_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attorney_cases_attorney_id ON public.attorney_cases(attorney_id);
CREATE INDEX IF NOT EXISTS idx_attorney_cases_case_id ON public.attorney_cases(case_id);

-- ============================================================================
-- 6. CREATE JAIL IP VIOLATIONS TABLE FOR TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.jail_ip_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    violation_type TEXT DEFAULT 'jail_ip_match' CHECK (violation_type IN ('jail_ip_match', 'ban_evasion')),
    count INTEGER DEFAULT 1,
    banned_until TIMESTAMPTZ,
    is_permanent_ban BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jail_ip_violations_ip ON public.jail_ip_violations(ip_address);
CREATE INDEX IF NOT EXISTS idx_jail_ip_violations_user ON public.jail_ip_violations(user_id);

-- ============================================================================
-- 7. ADD PROSECUTOR COLUMNS TO COURT CASES
-- ============================================================================
ALTER TABLE public.court_cases
ADD COLUMN IF NOT EXISTS prosecutor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS attorney_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS case_details JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- 8. CREATE INMATE MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inmate_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inmate_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    cost INTEGER DEFAULT 10,
    is_free_message BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inmate_messages_inmate ON public.inmate_messages(inmate_id);
CREATE INDEX IF NOT EXISTS idx_inmate_messages_recipient ON public.inmate_messages(recipient_id);

-- ============================================================================
-- 9. ADD MESSAGE RESTRICTION COLUMNS TO PROFILES
-- ============================================================================
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS has_messaged_inmate BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS inmate_can_message_back BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS free_message_used BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 10. UPDATE APPLICATIONS TABLE TO INCLUDE NEW TYPES
-- ============================================================================
-- Note: The applications table should already exist, we're adding new types
-- This is informational - the existing table structure should work with new types

-- ============================================================================
-- 11. RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Attorney Applications RLS
ALTER TABLE public.attorney_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view attorney applications" ON public.attorney_applications;
CREATE POLICY "Anyone can view attorney applications" ON public.attorney_applications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create attorney applications" ON public.attorney_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can create attorney applications" ON public.attorney_applications FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage attorney applications" ON public.attorney_applications FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);

-- Prosecutor Applications RLS
ALTER TABLE public.prosecutor_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view prosecutor applications" ON public.prosecutor_applications FOR SELECT USING (true);
CREATE POLICY "Anyone can view prosecutor applications" ON public.prosecutor_applications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create prosecutor applications" ON public.prosecutor_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can create prosecutor applications" ON public.prosecutor_applications FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage prosecutor applications" ON public.prosecutor_applications FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);

-- Attorney Cases RLS
ALTER TABLE public.attorney_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view attorney cases" ON public.attorney_cases FOR SELECT USING (true);
CREATE POLICY "Anyone can view attorney cases" ON public.attorney_cases FOR SELECT USING (true);

DROP POLICY IF EXISTS "Attorneys and admin can manage attorney cases" ON public.attorney_cases FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_attorney = true OR is_lead_officer = true)
    )
);

-- Inmate Messages RLS
ALTER TABLE public.inmate_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inmates and participants can view messages" ON public.inmate_messages FOR SELECT USING (true);
CREATE POLICY "Inmates and participants can view messages" ON public.inmate_messages FOR SELECT USING (
    inmate_id = auth.uid() OR 
    sender_id = auth.uid() OR 
    recipient_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_troll_officer = true OR is_lead_officer = true)
    )
);

DROP POLICY IF EXISTS "Inmates and staff can create messages" ON public.inmate_messages FOR INSERT WITH CHECK (
    inmate_id = auth.uid() OR 
    sender_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_troll_officer = true OR is_lead_officer = true)
    )
);

-- Jail IP Violations RLS
ALTER TABLE public.jail_ip_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view jail ip violations" ON public.jail_ip_violations FOR SELECT USING (true);
CREATE POLICY "Public can view jail ip violations" ON public.jail_ip_violations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin can manage jail ip violations" ON public.jail_ip_violations FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);

-- ============================================================================
-- 12. FUNCTIONS FOR JAIL IP CHECKING
-- ============================================================================

-- Function to check if IP is associated with jailed user
CREATE OR REPLACE FUNCTION public.check_jail_ip_match(p_ip_address TEXT)
RETURNS TABLE(user_id UUID, username TEXT, jail_count INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.user_id,
        up.username,
        COUNT(j.id)::INTEGER as jail_count
    FROM public.jail j
    JOIN public.user_profiles up ON up.id = j.user_id
    WHERE j.ip_address = p_ip_address
    GROUP BY j.user_id, up.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record IP violation and potentially ban
CREATE OR REPLACE FUNCTION public.check_and_ban_jail_evader(p_user_id UUID, p_ip_address TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    violation_count INTEGER;
    is_banned BOOLEAN := FALSE;
BEGIN
    -- Check existing violations for this IP
    SELECT COUNT(*) INTO violation_count
    FROM public.jail_ip_violations
    WHERE ip_address = p_ip_address;
    
    -- Increment or create violation
    IF violation_count > 0 THEN
        UPDATE public.jail_ip_violations 
        SET count = count + 1,
            is_permanent_ban = CASE WHEN count + 1 >= 3 THEN TRUE ELSE is_permanent_ban END,
            banned_until = CASE WHEN count + 1 >= 3 THEN NOW() + INTERVAL '100 years' ELSE banned_until END
        WHERE ip_address = p_ip_address;
        
        IF violation_count + 1 >= 3 THEN
            is_banned := TRUE;
        END IF;
    ELSE
        INSERT INTO public.jail_ip_violations (ip_address, user_id, count)
        VALUES (p_ip_address, p_user_id, 1);
    END IF;
    
    RETURN is_banned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 13. UPDATE EXISTING JAIL INSERT FUNCTION TO INCLUDE NEW COLUMNS
-- ============================================================================

-- Function to create jail record with enhanced data
CREATE OR REPLACE FUNCTION public.create_jail_record(
    p_user_id UUID,
    p_release_time TIMESTAMPTZ,
    p_reason TEXT DEFAULT NULL,
    p_sentence_days INTEGER DEFAULT 1,
    p_arrest_by UUID DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_jail_id UUID;
BEGIN
    INSERT INTO public.jail (
        user_id,
        release_time,
        reason,
        sentence_days,
        arrest_by,
        ip_address
    )
    VALUES (
        p_user_id,
        p_release_time,
        p_reason,
        p_sentence_days,
        p_arrest_by,
        p_ip_address
    )
    RETURNING id INTO v_jail_id;
    
    RETURN v_jail_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 14. ADD COLUMNS FOR BROADCAST MOD ACTIONS
-- ============================================================================
ALTER TABLE public.broadcast_seats
ADD COLUMN IF NOT EXISTS last_interaction TIMESTAMPTZ;

-- ============================================================================
-- 15. ENABLE RLS ON JAIL TABLE (if not already enabled)
-- ============================================================================
ALTER TABLE public.jail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view jail" ON public.jail;
CREATE POLICY "Public can view jail" ON public.jail FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff can manage jail" ON public.jail FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_troll_officer = true OR is_lead_officer = true)
    )
);

-- ============================================================================
-- 16. ADD TCNN LIVE AUTO-PLAY COLUMN
-- ============================================================================
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS last_tcnn_live_check TIMESTAMPTZ;

-- ============================================================================
-- 17. UPDATE COURT CASES TO INCLUDE SENTENCE TO JAIL
-- ============================================================================
-- The court_cases status already has 'warrant_issued' which can be used for jail sentencing
-- We'll ensure 'sentence_to_jail' is handled through the existing warrant system

-- ============================================================================
-- 18. ADD COLUMNS FOR ATTORNEY/PROSECUTOR DASHBOARD
-- ============================================================================
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS current_dashboard TEXT DEFAULT NULL;

-- ============================================================================
-- COMPLETE
-- ============================================================================
SELECT 'Jail, Attorney, Prosecutor and Court Enhancements Complete' as result;
