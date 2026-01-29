-- Migration: Fix0, Fix2, Fix3 - Complete Feature Implementation
-- Covers: TCPS, Housing, Revenue Share, Broadcast Enhancements

-- ==========================================
-- 1. Broadcast Enhancements (Fix0)
-- ==========================================

-- Broadcast Sessions / Streams updates
-- Ensure streams table has necessary columns for broadcast level
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'broadcast_level_percent') THEN
        ALTER TABLE public.streams ADD COLUMN broadcast_level_percent INTEGER DEFAULT 0 CHECK (broadcast_level_percent BETWEEN 0 AND 100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'last_gift_at') THEN
        ALTER TABLE public.streams ADD COLUMN last_gift_at TIMESTAMPTZ;
    END IF;
END $$;

-- Admin For A Week Queue
CREATE TABLE IF NOT EXISTS public.admin_for_week_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'active', 'completed', 'removed')),
    scheduled_start_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Moderation Actions Log (Audit)
CREATE TABLE IF NOT EXISTS public.moderation_actions_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES public.user_profiles(id), -- Who did it
    target_user_id UUID REFERENCES public.user_profiles(id), -- Who was it done to
    action_type TEXT NOT NULL, -- 'kick', 'ban', 'mute', 'disable_chat', 'system_grant_admin'
    reason TEXT,
    context JSONB DEFAULT '{}'::jsonb, -- broadcast_id, chat_id, etc.
    duration_minutes INTEGER, -- for temp bans/mutes
    original_state JSONB, -- For rollback
    is_reverted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Moderation Log
ALTER TABLE public.moderation_actions_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view moderation logs" ON public.moderation_actions_log;
CREATE POLICY "Staff view moderation logs" ON public.moderation_actions_log
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'troll_officer', 'lead_troll_officer', 'secretary') OR is_admin = true))
    );

-- ==========================================
-- 2. Housing System (Fix2)
-- ==========================================

-- Property Types
CREATE TABLE IF NOT EXISTS public.property_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_rent INTEGER DEFAULT 1000,
    base_utilities INTEGER DEFAULT 100,
    max_occupants INTEGER DEFAULT 2
);

INSERT INTO public.property_types (id, name, base_rent, base_utilities, max_occupants) VALUES
('trailer', 'Trailer', 500, 50, 1),
('apartment', 'Apartment', 1500, 150, 2),
('house', 'House', 3000, 300, 4),
('mansion', 'Mansion', 10000, 1000, 10)
ON CONFLICT (id) DO NOTHING;

-- Properties (Apartments/Listings)
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.user_profiles(id), -- Null means System/Bank owned
    type_id TEXT REFERENCES public.property_types(id) DEFAULT 'apartment',
    name TEXT NOT NULL,
    address TEXT,
    rent_amount INTEGER NOT NULL,
    utility_cost INTEGER NOT NULL,
    is_for_rent BOOLEAN DEFAULT true,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Applications
CREATE TABLE IF NOT EXISTS public.apartment_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id),
    applicant_id UUID REFERENCES public.user_profiles(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leases
CREATE TABLE IF NOT EXISTS public.leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id),
    tenant_id UUID REFERENCES public.user_profiles(id),
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    rent_due_day INTEGER DEFAULT 1,
    last_rent_paid_at TIMESTAMPTZ,
    last_utility_paid_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'evicted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, tenant_id, status)
);

-- Invoices / Rent Payment Log (Extended for Utilities)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id UUID REFERENCES public.leases(id),
    tenant_id UUID REFERENCES public.user_profiles(id),
    type TEXT NOT NULL CHECK (type IN ('rent', 'electric', 'water', 'deposit', 'application_fee')),
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    due_date TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank Loans (Restricted)
CREATE TABLE IF NOT EXISTS public.bank_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id),
    loan_type TEXT NOT NULL CHECK (loan_type IN ('rent_loan', 'deposit_loan')),
    amount INTEGER NOT NULL,
    remaining_balance INTEGER NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'defaulted')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Court Cases
CREATE TABLE IF NOT EXISTS public.court_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plaintiff_id UUID REFERENCES public.user_profiles(id), -- Landlord or System
    defendant_id UUID REFERENCES public.user_profiles(id), -- Tenant
    lease_id UUID REFERENCES public.leases(id),
    case_type TEXT NOT NULL CHECK (case_type IN ('non_payment', 'eviction', 'lease_violation')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'ruled', 'dismissed')),
    details TEXT,
    ruling TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Housing
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apartment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_cases ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for speed, refine later if needed)
DROP POLICY IF EXISTS "Public read properties" ON public.properties;
CREATE POLICY "Public read properties" ON public.properties FOR SELECT USING (true);
DROP POLICY IF EXISTS "Owners manage properties" ON public.properties;
CREATE POLICY "Owners manage properties" ON public.properties FOR ALL USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)));

DROP POLICY IF EXISTS "Users read own applications" ON public.apartment_applications;
CREATE POLICY "Users read own applications" ON public.apartment_applications FOR SELECT USING (applicant_id = auth.uid());
DROP POLICY IF EXISTS "Landlords read applications" ON public.apartment_applications;
CREATE POLICY "Landlords read applications" ON public.apartment_applications FOR SELECT USING (EXISTS (SELECT 1 FROM public.properties WHERE id = apartment_applications.property_id AND owner_id = auth.uid()));
DROP POLICY IF EXISTS "Users insert applications" ON public.apartment_applications;
CREATE POLICY "Users insert applications" ON public.apartment_applications FOR INSERT WITH CHECK (applicant_id = auth.uid());

CREATE POLICY "Users read own leases" ON public.leases FOR SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Landlords read leases" ON public.leases FOR SELECT USING (EXISTS (SELECT 1 FROM public.properties WHERE id = leases.property_id AND owner_id = auth.uid()));

CREATE POLICY "Users read own invoices" ON public.invoices FOR SELECT USING (tenant_id = auth.uid());
CREATE POLICY "Landlords read invoices" ON public.invoices FOR SELECT USING (EXISTS (SELECT 1 FROM public.leases l JOIN public.properties p ON l.property_id = p.id WHERE l.id = invoices.lease_id AND p.owner_id = auth.uid()));

-- ==========================================
-- 3. Revenue Share (Fix3)
-- ==========================================

-- Revenue Settings
CREATE TABLE IF NOT EXISTS public.revenue_system_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    officer_rent_share_percent INTEGER DEFAULT 10,
    admin_landlord_exempt BOOLEAN DEFAULT true,
    utility_admin_pool_enabled BOOLEAN DEFAULT true
);

INSERT INTO public.revenue_system_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Admin Pool & Officer Pool
-- We will use coin_ledger with buckets: 'officer_pool', 'admin_pool'
-- No new tables needed if we follow the ledger pattern.

-- ==========================================
-- 4. Car Valuation (Fix0)
-- ==========================================

-- Add valuation column to user_cars if exists, or assume calculation on fly.
-- Let's add a cached value column for performance.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_cars') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_cars' AND column_name = 'current_value') THEN
            ALTER TABLE public.user_cars ADD COLUMN current_value INTEGER DEFAULT 0;
        END IF;
    END IF;
END $$;
