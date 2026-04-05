-- ============================================================================
-- TROLL CITY COMPLETE JAIL, COURT, ATTORNEY, PROSECUTOR SYSTEM
-- ============================================================================
-- This migration includes all features for:
-- 1. Jail system with auto-release
-- 2. Inmate messaging (10 TC per message)
-- 3. Bond system (goes to admin)
-- 4. Attorney system (dashboard, cases, fees, pro bono, badge)
-- 5. Prosecutor system (dashboard, cases, badge)
-- 6. Court system (summon, sentencing, no AI)
-- 7. Appeals system (500 TC fee)
-- 8. Notifications (arrest, sentencing, release, bond, attorney, court, messages)
-- 9. Admin override actions (release, edit sentence, refund, force assign attorney)
-- 10. Security features (spam detection, multi-account evasion, IP checking)
-- 11. Payment flows (message fees to public pool, bond to admin, attorney fees)
-- 12. Bond request system for inmates
-- ============================================================================

-- ============================================================================
-- 1. CORE JAIL TABLE ENHANCEMENTS
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
ADD COLUMN IF NOT EXISTS free_message_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS auto_release_processed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS release_notification_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_jail_release_time ON public.jail(release_time);
CREATE INDEX IF NOT EXISTS idx_jail_ip_address ON public.jail(ip_address);
CREATE INDEX IF NOT EXISTS idx_jail_user_id ON public.jail(user_id);

-- ============================================================================
-- 2. USER PROFILE ENHANCEMENTS
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
ADD COLUMN IF NOT EXISTS ip_address_history TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_background_jailed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS background_jail_reason TEXT,
ADD COLUMN IF NOT EXISTS background_jail_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS background_jail_appealed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS background_jail_appeal_fee INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS has_pending_bond_request BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS negative_balance_allowed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_messaged_inmate BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS inmate_can_message_back BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS free_message_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_tcnn_live_check TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_dashboard TEXT DEFAULT NULL;

-- ============================================================================
-- 3. ATTORNEY APPLICATIONS TABLE
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
-- 4. PROSECUTOR APPLICATIONS TABLE
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
-- 5. ATTORNEY CASES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attorney_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attorney_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    case_id UUID REFERENCES public.court_cases(id) ON DELETE CASCADE,
    victim_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn')),
    fee_paid INTEGER DEFAULT 0,
    fee_paid_bool BOOLEAN DEFAULT FALSE,
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
    is_pro_bono BOOLEAN DEFAULT FALSE,
    case_extended BOOLEAN DEFAULT FALSE,
    next_payment_due TIMESTAMPTZ,
    case_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attorney_cases_attorney_id ON public.attorney_cases(attorney_id);
CREATE INDEX IF NOT EXISTS idx_attorney_cases_case_id ON public.attorney_cases(case_id);

-- ============================================================================
-- 6. JAIL IP VIOLATIONS TABLE
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
-- 7. INMATE MESSAGES TABLE
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
CREATE INDEX IF NOT EXISTS idx_inmate_messages_sender ON public.inmate_messages(sender_id);

-- ============================================================================
-- 8. JAIL APPEALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.jail_appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jail_id UUID REFERENCES public.jail(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    appeal_text TEXT NOT NULL,
    fee_paid INTEGER DEFAULT 500,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jail_appeals_user_id ON public.jail_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_jail_appeals_status ON public.jail_appeals(status);

-- ============================================================================
-- 9. BOND REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bond_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jail_id UUID REFERENCES public.jail(id) ON DELETE CASCADE,
    inmate_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bond_requests_inmate ON public.bond_requests(inmate_id);
CREATE INDEX IF NOT EXISTS idx_bond_requests_requester ON public.bond_requests(requester_id);

-- ============================================================================
-- 10. USER FOLLOWERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_followers_follower ON public.user_followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_followers_following ON public.user_followers(following_id);

-- ============================================================================
-- 11. JAIL TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.jail_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jail_id UUID REFERENCES public.jail(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('message_fee', 'bond', 'appeal_fee', 'refund', 'attorney_fee')),
    amount INTEGER NOT NULL,
    recipient_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    recipient_type TEXT CHECK (recipient_type IN ('public_pool', 'admin', 'attorney')),
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jail_transactions_jail ON public.jail_transactions(jail_id);
CREATE INDEX IF NOT EXISTS idx_jail_transactions_user ON public.jail_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_jail_transactions_type ON public.jail_transactions(transaction_type);

-- ============================================================================
-- 12. JAIL NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.jail_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('arrest', 'sentencing', 'release', 'bond_posted', 'attorney_hired', 'court_date', 'message_received', 'appeal_result', 'bond_request')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jail_notifications_user ON public.jail_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_jail_notifications_read ON public.jail_notifications(user_id, is_read);

-- ============================================================================
-- 13. JAIL SECURITY VIOLATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.jail_security_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    ip_address TEXT,
    violation_type TEXT NOT NULL CHECK (violation_type IN ('spam_messages', 'fake_arrest', 'bond_abuse', 'multi_account', 'other')),
    severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    details JSONB DEFAULT '{}'::jsonb,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jail_security_user ON public.jail_security_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_jail_security_ip ON public.jail_security_violations(ip_address);

-- ============================================================================
-- 14. COURT CASES ENHANCEMENTS
-- ============================================================================
ALTER TABLE public.court_cases
ADD COLUMN IF NOT EXISTS prosecutor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS attorney_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS case_details JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS judgment TEXT,
ADD COLUMN IF NOT EXISTS warrant_active BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 15. RLS POLICIES
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

ALTER TABLE public.prosecutor_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view prosecutor applications" ON public.prosecutor_applications;
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

ALTER TABLE public.attorney_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view attorney cases" ON public.attorney_cases;
CREATE POLICY "Anyone can view attorney cases" ON public.attorney_cases FOR SELECT USING (true);

DROP POLICY IF EXISTS "Attorneys and admin can manage attorney cases" ON public.attorney_cases FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_attorney = true OR is_lead_officer = true)
    )
);

ALTER TABLE public.inmate_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Inmates and participants can view messages" ON public.inmate_messages;
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

ALTER TABLE public.jail_appeals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own appeals" ON public.jail_appeals;
CREATE POLICY "Users can view own appeals" ON public.jail_appeals FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create appeals" ON public.jail_appeals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can create appeals" ON public.jail_appeals FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can manage appeals" ON public.jail_appeals FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);

ALTER TABLE public.bond_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own bond requests" ON public.bond_requests;
CREATE POLICY "Users can manage own bond requests" ON public.bond_requests FOR ALL USING (
    inmate_id = auth.uid() OR requester_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true OR is_troll_officer = true)
    )
);

ALTER TABLE public.jail_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own jail notifications" ON public.jail_notifications;
CREATE POLICY "Users can view own jail notifications" ON public.jail_notifications FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff can create jail notifications" ON public.jail_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can create jail notifications" ON public.jail_notifications FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true OR is_troll_officer = true OR is_attorney = true OR is_prosecutor = true)
    )
);

ALTER TABLE public.jail_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own jail transactions" ON public.jail_transactions;
CREATE POLICY "Users can view own jail transactions" ON public.jail_transactions FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);

ALTER TABLE public.user_followers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own followers" ON public.user_followers;
CREATE POLICY "Users can view own followers" ON public.user_followers FOR SELECT USING (
    follower_id = auth.uid() OR following_id = auth.uid()
);

ALTER TABLE public.jail_ip_violations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view jail ip violations" ON public.jail_ip_violations;
CREATE POLICY "Public can view jail ip violations" ON public.jail_ip_violations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin can manage jail ip violations" ON public.jail_ip_violations FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);

ALTER TABLE public.jail_security_violations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view security violations" ON public.jail_security_violations;
CREATE POLICY "Staff can view security violations" ON public.jail_security_violations FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);

-- ============================================================================
-- 16. FUNCTIONS - AUTO RELEASE INMATES
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_release_inmates()
RETURNS TABLE(user_id UUID, username TEXT, days_served INTEGER) AS $$
DECLARE
    released RECORD;
BEGIN
    FOR released IN
        SELECT j.user_id, up.username, EXTRACT(DAY FROM (NOW() - j.created_at))::INTEGER as days_served
        FROM public.jail j
        JOIN public.user_profiles up ON up.id = j.user_id
        WHERE j.release_time <= NOW() AND j.release_time IS NOT NULL
        AND j.auto_release_processed = false
    LOOP
        UPDATE public.jail 
        SET auto_release_processed = true,
            release_notification_sent = true,
            updated_at = NOW()
        WHERE user_id = released.user_id AND release_time <= NOW();
        
        UPDATE public.user_profiles 
        SET is_background_jailed = true,
            background_jail_date = NOW(),
            background_jail_reason = 'Released from active jail - viewable in profile'
        WHERE id = released.user_id;
        
        INSERT INTO public.jail_notifications (user_id, notification_type, title, message, data)
        VALUES (
            released.user_id,
            'release',
            'Jail Release',
            'You have been released from active jail. You can now use most city services again.',
            jsonb_build_object('days_served', released.days_served)
        );
        
        PERFORM public.refund_unused_message_coins(released.user_id, released.user_id);
        
        RETURN NEXT released;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 17. FUNCTION - CLEAR BACKGROUND JAIL AFTER 24 HOURS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.clear_background_jail()
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_profiles
    SET is_background_jailed = false,
        background_jail_date = NULL,
        background_jail_reason = NULL,
        background_jail_appealed = false
    WHERE is_background_jailed = true
    AND background_jail_date < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 18. FUNCTION - PROCESS INMATE MESSAGE FEE (TO PUBLIC POOL)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_inmate_message_fee(
    p_jail_id UUID,
    p_sender_id UUID,
    p_amount INTEGER DEFAULT 10
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_amount
    WHERE id = p_sender_id;

    INSERT INTO public.jail_transactions (jail_id, user_id, transaction_type, amount, recipient_type, notes)
    VALUES (p_jail_id, p_sender_id, 'message_fee', p_amount, 'public_pool', 'Inmate message fee');

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 19. FUNCTION - PROCESS BOND PAYMENT (TO ADMIN)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_bond_payment(
    p_jail_id UUID,
    p_payer_id UUID,
    p_amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_admin_id UUID;
BEGIN
    SELECT id INTO v_admin_id FROM public.system_wallets WHERE wallet_type = 'admin' LIMIT 1;
    
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_amount
    WHERE id = p_payer_id;

    IF v_admin_id IS NOT NULL THEN
        UPDATE public.system_wallets
        SET balance = balance + p_amount
        WHERE id = v_admin_id;
    END IF;

    UPDATE public.jail
    SET bond_posted = true, bond_posted_by = p_payer_id, updated_at = NOW()
    WHERE id = p_jail_id;

    INSERT INTO public.jail_transactions (jail_id, user_id, transaction_type, amount, recipient_type, notes)
    VALUES (p_jail_id, p_payer_id, 'bond', p_amount, 'admin', 'Bond payment');

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 20. FUNCTION - PROCESS ATTORNEY PAYMENT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_attorney_payment(
    p_attorney_case_id UUID,
    p_payer_id UUID,
    p_amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_attorney_id UUID;
    v_attorney_case RECORD;
BEGIN
    SELECT * INTO v_attorney_case FROM public.attorney_cases WHERE id = p_attorney_case_id;
    
    IF v_attorney_case IS NULL THEN
        RAISE EXCEPTION 'Attorney case not found';
    END IF;

    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_amount
    WHERE id = p_payer_id;

    UPDATE public.user_profiles
    SET troll_coins = troll_coins + p_amount
    WHERE id = v_attorney_case.attorney_id;

    UPDATE public.attorney_cases
    SET fee_paid_bool = true, payment_status = 'paid', updated_at = NOW()
    WHERE id = p_attorney_case_id;

    INSERT INTO public.jail_transactions (jail_id, user_id, transaction_type, amount, recipient_id, recipient_type, notes)
    VALUES (v_attorney_case.case_id, p_payer_id, 'attorney_fee', p_amount, v_attorney_case.attorney_id, 'attorney', 'Attorney fee payment per case');

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 21. FUNCTION - PROCESS APPEAL FEE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_appeal_fee(
    p_jail_id UUID,
    p_user_id UUID,
    p_amount INTEGER DEFAULT 500
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_amount
    WHERE id = p_user_id;

    INSERT INTO public.jail_transactions (jail_id, user_id, transaction_type, amount, recipient_type, notes)
    VALUES (p_jail_id, p_user_id, 'appeal_fee', p_amount, 'public_pool', 'Jail appeal fee');

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 22. FUNCTION - CREATE JAIL NOTIFICATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_jail_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO public.jail_notifications (user_id, notification_type, title, message, data)
    VALUES (p_user_id, p_type, p_title, p_message, p_data)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 23. FUNCTION - NOTIFY ON ARREST
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_arrest(
    p_user_id UUID,
    p_days INTEGER,
    p_reason TEXT,
    p_arrest_by UUID
)
RETURNS VOID AS $$
DECLARE
    v_arrestor_name TEXT;
BEGIN
    SELECT username INTO v_arrestor_name FROM public.user_profiles WHERE id = p_arrest_by;
    
    PERFORM create_jail_notification(
        p_user_id,
        'arrest',
        'You Have Been Arrested',
        'You have been sentenced to ' || p_days || ' day(s) in jail. Reason: ' || p_reason || '. Arrested by: ' || COALESCE(v_arrestor_name, 'System'),
        jsonb_build_object('days', p_days, 'reason', p_reason, 'arrest_by', p_arrest_by)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 24. FUNCTION - NOTIFY ON SENTENCING
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_sentencing(
    p_user_id UUID,
    p_days INTEGER,
    p_reason TEXT
)
RETURNS VOID AS $$
BEGIN
    PERFORM create_jail_notification(
        p_user_id,
        'sentencing',
        'Court Sentencing',
        'You have been sentenced to ' || p_days || ' day(s) in jail by the court. Reason: ' || p_reason,
        jsonb_build_object('days', p_days, 'reason', p_reason)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 25. FUNCTION - NOTIFY ON BOND POSTED
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_bond_posted(
    p_inmate_id UUID,
    p_amount INTEGER,
    p_posted_by UUID
)
RETURNS VOID AS $$
DECLARE
    v_poster_name TEXT;
BEGIN
    SELECT username INTO v_poster_name FROM public.user_profiles WHERE id = p_posted_by;
    
    PERFORM create_jail_notification(
        p_inmate_id,
        'bond_posted',
        'Bond Posted',
        v_poster_name || ' has posted a bond of ' || p_amount || ' TC on your behalf.',
        jsonb_build_object('amount', p_amount, 'posted_by', p_posted_by)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 26. FUNCTION - NOTIFY ON ATTORNEY HIRED
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_attorney_hired(
    p_inmate_id UUID,
    p_attorney_id UUID,
    p_fee INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_attorney_name TEXT;
BEGIN
    SELECT username INTO v_attorney_name FROM public.user_profiles WHERE id = p_attorney_id;
    
    PERFORM create_jail_notification(
        p_inmate_id,
        'attorney_hired',
        'Attorney Hired',
        v_attorney_name || ' has been hired as your attorney. Fee: ' || p_fee || ' TC',
        jsonb_build_object('attorney_id', p_attorney_id, 'fee', p_fee)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 27. FUNCTION - NOTIFY ON COURT DATE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_court_date(
    p_user_id UUID,
    p_case_id UUID,
    p_court_date TIMESTAMPTZ,
    p_reason TEXT
)
RETURNS VOID AS $$
BEGIN
    PERFORM create_jail_notification(
        p_user_id,
        'court_date',
        'Court Date Scheduled',
        'Your court date is scheduled for ' || p_court_date || '. Reason: ' || p_reason,
        jsonb_build_object('case_id', p_case_id, 'court_date', p_court_date, 'reason', p_reason)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 28. FUNCTION - NOTIFY ON MESSAGE RECEIVED (INMATE)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_message_received(
    p_inmate_id UUID,
    p_sender_id UUID,
    p_message_preview TEXT
)
RETURNS VOID AS $$
DECLARE
    v_sender_name TEXT;
BEGIN
    SELECT username INTO v_sender_name FROM public.user_profiles WHERE id = p_sender_id;
    
    PERFORM create_jail_notification(
        p_inmate_id,
        'message_received',
        'New Message',
        'You received a message from ' || v_sender_name || ': ' || p_message_preview,
        jsonb_build_object('sender_id', p_sender_id, 'preview', p_message_preview)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 29. FUNCTION - LOG SECURITY VIOLATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_jail_violation(
    p_user_id UUID,
    p_violation_type TEXT,
    p_severity TEXT DEFAULT 'low',
    p_details JSONB DEFAULT '{}'::jsonb,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.jail_security_violations (user_id, ip_address, violation_type, severity, details)
    VALUES (p_user_id, p_ip_address, p_violation_type, p_severity, p_details);
    
    IF p_severity = 'critical' THEN
        PERFORM create_jail_notification(
            (SELECT id FROM public.user_profiles WHERE role = 'admin' LIMIT 1),
            'arrest',
            'CRITICAL: Jail Security Violation',
            'A critical security violation was detected. Type: ' || p_violation_type,
            jsonb_build_object('user_id', p_user_id, 'type', p_violation_type, 'details', p_details)
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 30. FUNCTION - CHECK SPAM MESSAGING
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_spam_messaging(p_user_id UUID, p_window_minutes INTEGER DEFAULT 5)
RETURNS BOOLEAN AS $$
DECLARE
    v_message_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_message_count
    FROM public.inmate_messages
    WHERE sender_id = p_user_id
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;
    
    IF v_message_count > 10 THEN
        PERFORM log_jail_violation(p_user_id, 'spam_messages', 'high', jsonb_build_object('count', v_message_count, 'window', p_window_minutes));
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 31. FUNCTION - CHECK JAIL IP MATCH
-- ============================================================================
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

-- ============================================================================
-- 32. FUNCTION - CHECK AND BAN JAIL EVADER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_and_ban_jail_evader(p_user_id UUID, p_ip_address TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    violation_count INTEGER;
    is_banned BOOLEAN := FALSE;
BEGIN
    SELECT COUNT(*) INTO violation_count
    FROM public.jail_ip_violations
    WHERE ip_address = p_ip_address;
    
    IF violation_count > 0 THEN
        UPDATE public.jail_ip_violations 
        SET count = count + 1,
            is_permanent_ban = CASE WHEN count + 1 >= 3 THEN TRUE ELSE is_permanent_ban END,
            banned_until = CASE WHEN count + 1 >= 3 THEN NOW() + INTERVAL '100 years' ELSE banned_until END
        WHERE ip_address = p_ip_address;
        
        IF violation_count + 1 >= 3 THEN
            is_banned := TRUE;
            
            UPDATE public.user_profiles
            SET is_banned = true
            WHERE ip_address_history @> ARRAY[p_ip_address];
        END IF;
    ELSE
        INSERT INTO public.jail_ip_violations (ip_address, user_id, count)
        VALUES (p_ip_address, p_user_id, 1);
    END IF;
    
    RETURN is_banned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 33. FUNCTION - CHECK MULTI ACCOUNT EVASION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_multi_account_evasion(p_ip_address TEXT, p_existing_user_id UUID)
RETURNS TABLE(is_evading BOOLEAN, existing_count INTEGER) AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT user_id) INTO v_count
    FROM public.jail
    WHERE ip_address = p_ip_address
    AND user_id != p_existing_user_id
    AND release_time > NOW();
    
    IF v_count >= 1 THEN
        PERFORM log_jail_violation(p_existing_user_id, 'multi_account', 'critical', jsonb_build_object('ip_address', p_ip_address, 'existing_count', v_count), p_ip_address);
    END IF;
    
    RETURN QUERY SELECT (v_count >= 1)::BOOLEAN, v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 34. FUNCTION - HANDLE COURT NO-SHOW (BOND REVOCATION)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_court_no_show(p_case_id UUID)
RETURNS VOID AS $$
DECLARE
    v_case RECORD;
    v_inmate_jail RECORD;
BEGIN
    SELECT * INTO v_case FROM public.court_cases WHERE id = p_case_id;
    
    IF v_case IS NULL THEN
        RETURN;
    END IF;

    SELECT * INTO v_inmate_jail FROM public.jail WHERE user_id = v_case.defendant_id AND release_time > NOW();
    
    IF v_inmate_jail IS NOT NULL THEN
        IF v_inmate_jail.bond_posted THEN
            PERFORM process_bond_payment(v_inmate_jail.id, v_inmate_jail.bond_posted_by, v_inmate_jail.bond_amount);
            
            INSERT INTO public.jail_transactions (jail_id, user_id, transaction_type, amount, recipient_type, notes)
            VALUES (v_inmate_jail.id, v_case.defendant_id, 'bond', v_inmate_jail.bond_amount, 'admin', 'Bond revoked due to court no-show');
        END IF;
        
        UPDATE public.jail
        SET bond_posted = false, bond_posted_by = NULL, updated_at = NOW()
        WHERE id = v_inmate_jail.id;
    END IF;

    PERFORM create_jail_notification(
        v_case.defendant_id,
        'arrest',
        'Returned to Jail',
        'You failed to appear in court. Your bond has been revoked and you have been returned to jail.',
        jsonb_build_object('case_id', p_case_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 35. FUNCTION - REFUND UNUSED MESSAGE COINS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refund_unused_message_coins(p_user_id UUID, p_jail_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_refund_amount INTEGER;
    v_minutes_used INTEGER;
    v_minutes_purchased INTEGER;
BEGIN
    SELECT message_minutes_used, message_minutes INTO v_minutes_used, v_minutes_purchased
    FROM public.jail WHERE id = p_jail_id;
    
    v_refund_amount := (v_minutes_purchased - v_minutes_used) * 10;
    
    IF v_refund_amount > 0 THEN
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + v_refund_amount
        WHERE id = p_user_id;
        
        INSERT INTO public.jail_transactions (jail_id, user_id, transaction_type, amount, notes)
        VALUES (p_jail_id, p_user_id, 'refund', v_refund_amount, 'Jail release - unused message minutes refunded');
    END IF;
    
    RETURN v_refund_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 36. FUNCTION - CREATE JAIL RECORD WITH ENHANCED DATA
-- ============================================================================
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
    
    PERFORM notify_arrest(p_user_id, p_sentence_days, p_reason, p_arrest_by);
    
    RETURN v_jail_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 37. ADMIN OVERRIDE FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_release_inmate(
    p_user_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT 'Admin override'
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.jail 
    SET release_time = NOW(),
        auto_release_processed = true,
        updated_at = NOW()
    WHERE user_id = p_user_id AND release_time > NOW();
    
    UPDATE public.user_profiles 
    SET is_background_jailed = false,
        background_jail_date = NULL,
        background_jail_reason = NULL
    WHERE id = p_user_id;
    
    INSERT INTO public.jail_transactions (jail_id, user_id, transaction_type, amount, notes)
    VALUES (
        (SELECT id FROM public.jail WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1),
        p_user_id,
        'refund',
        0,
        'Admin release: ' || p_reason
    );
    
    PERFORM create_jail_notification(
        p_user_id,
        'release',
        'Released by Admin',
        'You have been released by admin. Reason: ' || p_reason,
        jsonb_build_object('admin_id', p_admin_id, 'reason', p_reason)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_edit_sentence(
    p_user_id UUID,
    p_new_days INTEGER,
    p_admin_id UUID,
    p_reason TEXT DEFAULT 'Admin sentence modification'
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.jail 
    SET sentence_days = p_new_days,
        release_time = NOW() + (p_new_days || ' days')::INTERVAL,
        updated_at = NOW()
    WHERE user_id = p_user_id AND release_time > NOW();
    
    PERFORM create_jail_notification(
        p_user_id,
        'sentencing',
        'Sentence Modified',
        'Your sentence has been modified by admin to ' || p_new_days || ' days. Reason: ' || p_reason,
        jsonb_build_object('admin_id', p_admin_id, 'new_days', p_new_days, 'reason', p_reason)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_refund_coins(
    p_user_id UUID,
    p_amount INTEGER,
    p_admin_id UUID,
    p_reason TEXT DEFAULT 'Admin refund'
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + p_amount
    WHERE id = p_user_id;
    
    INSERT INTO public.jail_transactions (jail_id, user_id, transaction_type, amount, notes)
    VALUES (
        (SELECT id FROM public.jail WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1),
        p_user_id,
        'refund',
        p_amount,
        'Admin refund: ' || p_reason
    );
    
    PERFORM create_jail_notification(
        p_user_id,
        'release',
        'Coins Refunded',
        'You have been refunded ' || p_amount || ' TC by admin. Reason: ' || p_reason,
        jsonb_build_object('admin_id', p_admin_id, 'amount', p_amount, 'reason', p_reason)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_force_assign_attorney(
    p_case_id UUID,
    p_attorney_id UUID,
    p_admin_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_defendant_id UUID;
BEGIN
    SELECT defendant_id INTO v_defendant_id FROM public.court_cases WHERE id = p_case_id;
    
    INSERT INTO public.attorney_cases (attorney_id, case_id, victim_id, status, is_pro_bono)
    VALUES (p_attorney_id, p_case_id, v_defendant_id, 'active', false);
    
    UPDATE public.court_cases
    SET attorney_id = p_attorney_id
    WHERE id = p_case_id;
    
    PERFORM create_jail_notification(
        v_defendant_id,
        'attorney_hired',
        'Attorney Assigned',
        'An attorney has been assigned to your case by admin.',
        jsonb_build_object('attorney_id', p_attorney_id, 'admin_id', p_admin_id)
    );
    
    PERFORM create_jail_notification(
        p_attorney_id,
        'attorney_hired',
        'Case Assigned',
        'You have been assigned to a case by admin.',
        jsonb_build_object('case_id', p_case_id, 'admin_id', p_admin_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMPLETE
-- ============================================================================
SELECT 'Troll City Complete Jail, Court, Attorney, Prosecutor System Migration Complete' as result;
