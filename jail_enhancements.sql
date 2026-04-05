-- ============================================================================
-- JAIL ENHANCEMENTS: AUTO-RELEASE, APPEALS, PAYMENTS, NOTIFICATIONS, SECURITY
-- ============================================================================

-- ============================================================================
-- 1. ADD BACKGROUND JAIL AND ENHANCED COLUMNS TO PROFILES
-- ============================================================================
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_background_jailed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS background_jail_reason TEXT,
ADD COLUMN IF NOT EXISTS background_jail_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS background_jail_appealed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS background_jail_appeal_fee INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS has_pending_bond_request BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS negative_balance_allowed BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 2. CREATE JAIL APPEAL SYSTEM
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
-- 3. CREATE BOND REQUEST SYSTEM
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
-- 4. CREATE FOLLOWERS TABLE (for bond requests)
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
-- 5. CREATE JAIL PAYMENT TRANSACTIONS
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
-- 6. CREATE JAIL NOTIFICATIONS TABLE
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
-- 7. CREATE JAIL SECURITY VIOLATIONS TABLE
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
-- 8. ADD COLUMNS FOR ATTORNEY PAYMENTS
-- ============================================================================
ALTER TABLE public.attorney_cases
ADD COLUMN IF NOT EXISTS fee_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
ADD COLUMN IF NOT EXISTS case_extended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS next_payment_due TIMESTAMPTZ;

-- ============================================================================
-- 9. RLS POLICIES
-- ============================================================================

-- Jail Appeals RLS
ALTER TABLE public.jail_appeals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own appeals" ON public.jail_appeals;
CREATE POLICY "Users can view own appeals" ON public.jail_appeals FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create appeals" ON public.jail_appeals FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can manage appeals" ON public.jail_appeals FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);

-- Bond Requests RLS
ALTER TABLE public.bond_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own bond requests" ON public.bond_requests FOR ALL USING (
    inmate_id = auth.uid() OR requester_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true OR is_troll_officer = true)
    )
);

-- Jail Notifications RLS
ALTER TABLE public.jail_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own jail notifications" ON public.jail_notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view own jail notifications" ON public.jail_notifications FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff can create jail notifications" ON public.jail_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can create jail notifications" ON public.jail_notifications FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true OR is_troll_officer = true OR is_attorney = true OR is_prosecutor = true)
    )
);

-- Jail Transactions RLS
ALTER TABLE public.jail_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own jail transactions" ON public.jail_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view own jail transactions" ON public.jail_transactions FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
    )
);

-- User Followers RLS
ALTER TABLE public.user_followers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own followers" ON public.user_followers FOR SELECT USING (
    follower_id = auth.uid() OR following_id = auth.uid()
);

-- ============================================================================
-- 10. FUNCTIONS FOR JAIL AUTO-RELEASE
-- ============================================================================

-- Function to auto-release inmates when time is up
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
    LOOP
        -- Update jail record
        UPDATE public.jail 
        SET (release_time, updated_at) = (NULL, NOW())
        WHERE user_id = released.user_id AND release_time <= NOW();
        
        -- Set background jail (user can see they're jailed but can use app)
        UPDATE public.user_profiles 
        SET is_background_jailed = true,
            background_jail_date = NOW(),
            background_jail_reason = 'Released from active jail - viewable in profile'
        WHERE id = released.user_id;
        
        -- Create release notification
        INSERT INTO public.jail_notifications (user_id, notification_type, title, message, data)
        VALUES (
            released.user_id,
            'release',
            'Jail Release',
            'You have been released from active jail. You can now use most city services again. Your jail record is now visible in your background.',
            jsonb_build_object('days_served', released.days_served)
        );
        
        RETURN NEXT released;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and release background jailed users after 24 hours
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
-- 11. FUNCTIONS FOR PAYMENTS
-- ============================================================================

-- Function to process inmate message fee (goes to public pool)
CREATE OR REPLACE FUNCTION public.process_inmate_message_fee(
    p_jail_id UUID,
    p_sender_id UUID,
    p_amount INTEGER DEFAULT 10
)
RETURNS BOOLEAN AS $$
DECLARE
    v_public_pool_id TEXT := 'public_pool';
BEGIN
    -- Deduct from sender
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_amount
    WHERE id = p_sender_id;

    -- Log transaction
    INSERT INTO public.jail_transactions (jail_id, user_id, transaction_type, amount, recipient_type, notes)
    VALUES (p_jail_id, p_sender_id, 'message_fee', p_amount, 'public_pool', 'Inmate message fee');

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process bond payment (goes to admin)
CREATE OR REPLACE FUNCTION public.process_bond_payment(
    p_jail_id UUID,
    p_payer_id UUID,
    p_amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_admin_id UUID;
BEGIN
    -- Get admin wallet id
    SELECT id INTO v_admin_id FROM public.system_wallets WHERE wallet_type = 'admin' LIMIT 1;
    
    -- Deduct from payer
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_amount
    WHERE id = p_payer_id;

    -- Add to admin wallet if exists
    IF v_admin_id IS NOT NULL THEN
        UPDATE public.system_wallets
        SET balance = balance + p_amount
        WHERE id = v_admin_id;
    END IF;

    -- Update jail record
    UPDATE public.jail
    SET bond_posted = true, bond_posted_by = p_payer_id
    WHERE id = p_jail_id;

    -- Log transaction
    INSERT INTO public.jail_transactions (jail_id, user_id, transaction_type, amount, recipient_type, notes)
    VALUES (p_jail_id, p_payer_id, 'bond', p_amount, 'admin', 'Bond payment');

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process attorney payment
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
    -- Get attorney case details
    SELECT * INTO v_attorney_case FROM public.attorney_cases WHERE id = p_attorney_case_id;
    
    IF v_attorney_case IS NULL THEN
        RAISE EXCEPTION 'Attorney case not found';
    END IF;

    -- Deduct from payer (plaintiff or defendant)
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_amount
    WHERE id = p_payer_id;

    -- Add to attorney balance
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + p_amount
    WHERE id = v_attorney_case.attorney_id;

    -- Update attorney case
    UPDATE public.attorney_cases
    SET fee_paid = true, payment_status = 'paid'
    WHERE id = p_attorney_case_id;

    -- Log transaction
    INSERT INTO public.jail_transactions (jail_id, user_id, transaction_type, amount, recipient_id, recipient_type, notes)
    VALUES (v_attorney_case.case_id, p_payer_id, 'attorney_fee', p_amount, v_attorney_case.attorney_id, 'attorney', 'Attorney fee payment per case');

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process appeal fee
CREATE OR REPLACE FUNCTION public.process_appeal_fee(
    p_jail_id UUID,
    p_user_id UUID,
    p_amount INTEGER DEFAULT 500
)
RETURNS BOOLEAN AS $$
DECLARE
    v_public_pool_id TEXT := 'public_pool';
BEGIN
    -- Deduct from user
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_amount
    WHERE id = p_user_id;

    -- Log transaction
    INSERT INTO public.jail_transactions (jail_id, user_id, transaction_type, amount, recipient_type, notes)
    VALUES (p_jail_id, p_user_id, 'appeal_fee', p_amount, 'public_pool', 'Jail appeal fee');

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 12. FUNCTIONS FOR NOTIFICATIONS
-- ============================================================================

-- Function to create jail notification
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

-- Function to notify on arrest
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

-- Function to notify on sentencing
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

-- Function to notify on bond posted
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
-- 13. FUNCTIONS FOR SECURITY
-- ============================================================================

-- Function to log security violation
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
    
    -- If critical, notify admin
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

-- Function to check for spam messaging
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

-- Function to check for multi-account evasion
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
        -- Log the violation
        PERFORM log_jail_violation(p_existing_user_id, 'multi_account', 'critical', jsonb_build_object('ip_address', p_ip_address, 'existing_count', v_count), p_ip_address);
    END IF;
    
    RETURN QUERY SELECT (v_count >= 1)::BOOLEAN, v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 14. CREATE AUTO-RELEASE JOB (Runs every minute via cron)
-- ============================================================================
-- This would be set up as a pg_cron job in production:
-- SELECT cron.schedule('auto-release-inmates', '* * * * *', 'SELECT public.auto_release_inmates()');

-- ============================================================================
-- 15. UPDATE EXISTING JAIL TABLE FOR AUTO-RELEASE
-- ============================================================================
ALTER TABLE public.jail 
ADD COLUMN IF NOT EXISTS auto_release_processed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS release_notification_sent BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 16. FUNCTION TO HANDLE COURT NO-SHOW (BOND REVOCATION)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_court_no_show(p_case_id UUID)
RETURNS VOID AS $$
DECLARE
    v_case RECORD;
    v_inmate_jail RECORD;
BEGIN
    -- Get case details
    SELECT * INTO v_case FROM public.court_cases WHERE id = p_case_id;
    
    IF v_case IS NULL THEN
        RETURN;
    END IF;

    -- Get inmate's jail record
    SELECT * INTO v_inmate_jail FROM public.jail WHERE user_id = v_case.defendant_id AND release_time > NOW();
    
    IF v_inmate_jail IS NOT NULL THEN
        -- Revoke bond - bond goes to admin
        IF v_inmate_jail.bond_posted THEN
            PERFORM process_bond_payment(v_inmate_jail.id, v_inmate_jail.bond_posted_by, v_inmate_jail.bond_amount);
            
            -- Log as revoked
            INSERT INTO public.jail_transactions (jail_id, user_id, transaction_type, amount, recipient_type, notes)
            VALUES (v_inmate_jail.id, v_case.defendant_id, 'bond', v_inmate_jail.bond_amount, 'admin', 'Bond revoked due to court no-show');
        END IF;
        
        -- Send back to jail
        UPDATE public.jail
        SET bond_posted = false, bond_posted_by = NULL, updated_at = NOW()
        WHERE id = v_inmate_jail.id;
    END IF;

    -- Notify inmate
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
-- 17. FUNCTION FOR REFUNDS (Message coins on early release)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refund_unused_message_coins(p_user_id UUID, p_jail_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_refund_amount INTEGER;
    v_minutes_used INTEGER;
    v_minutes_purchased INTEGER;
BEGIN
    -- Get jail record
    SELECT message_minutes_used, message_minutes INTO v_minutes_used, v_minutes_purchased
    FROM public.jail WHERE id = p_jail_id;
    
    -- Calculate unused minutes
    v_refund_amount := (v_minutes_purchased - v_minutes_used) * 10; -- 10 TC per message
    
    IF v_refund_amount > 0 THEN
        -- Refund to user
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + v_refund_amount
        WHERE id = p_user_id;
        
        -- Log refund
        INSERT INTO public.jail_transactions (jail_id, user_id, transaction_type, amount, notes)
        VALUES (p_jail_id, p_user_id, 'refund', v_refund_amount, 'Jail release - unused message minutes refunded');
    END IF;
    
    RETURN v_refund_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMPLETE
-- ============================================================================
SELECT 'Jail Enhancements Complete: Auto-release, Appeals, Payments, Notifications, Security' as result;