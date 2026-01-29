-- Migration: Fix2 (Housing) and Fix3 (Revenue Share)

-- ==========================================
-- 1. Housing Schema
-- ==========================================

-- Property Types
CREATE TABLE IF NOT EXISTS public.property_types (
    id TEXT PRIMARY KEY, -- 'apartment', 'house', 'mansion', 'trailer'
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

-- Properties
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.user_profiles(id), -- Null means System/Bank owned
    type_id TEXT REFERENCES public.property_types(id) DEFAULT 'apartment',
    name TEXT NOT NULL, -- "Apt 101", "Trailer 5"
    address TEXT,
    rent_amount INTEGER NOT NULL,
    utility_cost INTEGER NOT NULL,
    is_for_rent BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add columns if table already exists (Legacy support)
DO $$
BEGIN
    -- type_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'type_id') THEN
        ALTER TABLE public.properties ADD COLUMN type_id TEXT REFERENCES public.property_types(id) DEFAULT 'apartment';
    END IF;

    -- rent_amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'rent_amount') THEN
        ALTER TABLE public.properties ADD COLUMN rent_amount INTEGER DEFAULT 1500;
    END IF;

    -- utility_cost
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'utility_cost') THEN
        ALTER TABLE public.properties ADD COLUMN utility_cost INTEGER DEFAULT 150;
    END IF;

    -- is_for_rent
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'is_for_rent') THEN
        ALTER TABLE public.properties ADD COLUMN is_for_rent BOOLEAN DEFAULT true;
    END IF;

    -- owner_id (if migrating from owner_user_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'owner_id') THEN
        ALTER TABLE public.properties ADD COLUMN owner_id UUID REFERENCES public.user_profiles(id);
    END IF;
    
    -- Sync owner_id from owner_user_id if it exists and owner_id is null
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'owner_user_id') THEN
        UPDATE public.properties SET owner_id = owner_user_id WHERE owner_id IS NULL;
    END IF;
END $$;

-- Leases
CREATE TABLE IF NOT EXISTS public.leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id),
    tenant_id UUID REFERENCES public.user_profiles(id),
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ, -- Null means indefinite
    rent_due_day INTEGER DEFAULT 1, -- Day of month
    last_rent_paid_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'evicted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, tenant_id, status) -- Prevent double active lease
);

-- Rent Payment Log
CREATE TABLE IF NOT EXISTS public.rent_payment_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id UUID REFERENCES public.leases(id),
    tenant_id UUID REFERENCES public.user_profiles(id),
    amount_paid INTEGER NOT NULL,
    rent_portion INTEGER NOT NULL,
    utility_portion INTEGER NOT NULL,
    tax_portion INTEGER NOT NULL, -- 10% of rent
    landlord_portion INTEGER NOT NULL, -- 90% of rent
    paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.property_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_payment_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read property types" ON public.property_types;
DROP POLICY IF EXISTS "Public read properties" ON public.properties;
DROP POLICY IF EXISTS "Public read leases" ON public.leases;
DROP POLICY IF EXISTS "Users read own rent logs" ON public.rent_payment_log;

CREATE POLICY "Public read property types" ON public.property_types FOR SELECT USING (true);
CREATE POLICY "Public read properties" ON public.properties FOR SELECT USING (true);
CREATE POLICY "Public read leases" ON public.leases FOR SELECT USING (true);
CREATE POLICY "Users read own rent logs" ON public.rent_payment_log FOR SELECT USING (tenant_id = auth.uid());

-- ==========================================
-- 2. Revenue Share Pools (System Accounts)
-- ==========================================
-- We will use special UUIDs or just track them in coin_ledger with 'system' as user_id or specific bucket.
-- Ideally we should have a 'funds' table or just assume specific user IDs for "Officer Pool" and "Admin Pool".
-- For this implementation, we will log to coin_ledger with 'officer_pool' and 'admin_pool' as the target 'user_id' (if UUID) or just use the bucket field.
-- To keep it simple and queryable, we will use the `coin_ledger` table with specific buckets.

-- ==========================================
-- 3. RPCs
-- ==========================================

-- RPC: Rent Property (Sign Lease)
CREATE OR REPLACE FUNCTION public.sign_lease(p_property_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_property RECORD;
    v_balance INTEGER;
    v_total_initial_cost INTEGER;
BEGIN
    -- Get Property
    SELECT * INTO v_property FROM public.properties WHERE id = p_property_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not found');
    END IF;

    IF v_property.is_for_rent = false THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not for rent');
    END IF;

    -- Check if already occupied (simple check, assume 1 lease per property for now unless max_occupants logic added later)
    IF EXISTS (SELECT 1 FROM public.leases WHERE property_id = p_property_id AND status = 'active') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property is occupied');
    END IF;

    -- Calculate initial cost (First month rent + utilities)
    v_total_initial_cost := v_property.rent_amount + v_property.utility_cost;

    -- Check balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < v_total_initial_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins for first month rent + utilities');
    END IF;

    -- Process Payment (Using pay_rent logic, but here we do it inline to ensure atomicity with lease creation)
    -- Actually, let's just create the lease and then call pay_rent immediately? 
    -- Better to do it all here.

    -- Deduct from Tenant
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_total_initial_cost WHERE id = v_user_id;

    -- Distribute Funds
    -- 1. Utilities (100% to Admin Pool)
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
    VALUES (v_user_id, -v_property.utility_cost, 'utility_payment', 'housing', 'Utility Payment');
    
    -- We record the inflow to Admin Pool implicitly by the fact it left the user for 'utility_payment'. 
    -- Or we can have a central 'bank' user. For now, just deducting from user is enough to "pay" the system.

    -- 2. Rent (Split)
    DECLARE
        v_tax INTEGER := v_property.rent_amount * 0.10;
        v_landlord_share INTEGER := v_property.rent_amount - v_tax;
    BEGIN
        -- Tax to Officer Pool (Just deduct from user and log as tax)
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
        VALUES (v_user_id, -v_tax, 'officer_tax', 'housing', 'Rent Tax (10%)');

        -- Landlord Share
        IF v_property.owner_id IS NOT NULL THEN
            -- Pay Landlord
            UPDATE public.user_profiles SET troll_coins = troll_coins + v_landlord_share WHERE id = v_property.owner_id;
            
            INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
            VALUES (v_property.owner_id, v_landlord_share, 'rent_income', 'housing', 'Rent Income from ' || v_property.name);
            
            -- Deduct the landlord share from tenant (The other parts were already deducted? No wait, we deducted v_total_initial_cost from tenant already)
            -- We just need to move the money.
            -- The initial UPDATE deducted the full amount from tenant.
            -- So the money is "gone" from tenant.
            -- Now we just add to landlord.
        ELSE
            -- System owned: The rent "disappears" (goes to system/admin pool)
            -- So we don't add to anyone.
            NULL;
        END IF;

        -- Create Lease
        INSERT INTO public.leases (property_id, tenant_id, last_rent_paid_at)
        VALUES (p_property_id, v_user_id, NOW());
        
        -- Log Payment
        INSERT INTO public.rent_payment_log (
            lease_id, tenant_id, amount_paid, rent_portion, utility_portion, tax_portion, landlord_portion
        ) VALUES (
            (SELECT id FROM public.leases WHERE property_id = p_property_id AND tenant_id = v_user_id AND status='active' LIMIT 1),
            v_user_id,
            v_total_initial_cost,
            v_property.rent_amount,
            v_property.utility_cost,
            v_tax,
            CASE WHEN v_property.owner_id IS NOT NULL THEN v_landlord_share ELSE 0 END
        );
    END;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Pay Rent (Manual)
CREATE OR REPLACE FUNCTION public.pay_rent(p_lease_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_lease RECORD;
    v_property RECORD;
    v_balance INTEGER;
    v_total_cost INTEGER;
    v_tax INTEGER;
    v_landlord_share INTEGER;
BEGIN
    SELECT * INTO v_lease FROM public.leases WHERE id = p_lease_id;
    IF NOT FOUND OR v_lease.tenant_id != v_user_id OR v_lease.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid lease');
    END IF;

    SELECT * INTO v_property FROM public.properties WHERE id = v_lease.property_id;

    v_total_cost := v_property.rent_amount + v_property.utility_cost;

    -- Check balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
    END IF;

    -- Deduct from Tenant
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_total_cost WHERE id = v_user_id;

    -- Calculate Split
    v_tax := v_property.rent_amount * 0.10;
    v_landlord_share := v_property.rent_amount - v_tax;

    -- Log Deductions
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
    VALUES (v_user_id, -v_property.utility_cost, 'utility_payment', 'housing', 'Utility Payment');

    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
    VALUES (v_user_id, -v_tax, 'officer_tax', 'housing', 'Rent Tax (10%)');

    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
    VALUES (v_user_id, -v_landlord_share, 'rent_payment', 'housing', 'Rent Payment');

    -- Pay Landlord
    IF v_property.owner_id IS NOT NULL THEN
        UPDATE public.user_profiles SET troll_coins = troll_coins + v_landlord_share WHERE id = v_property.owner_id;
        
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
        VALUES (v_property.owner_id, v_landlord_share, 'rent_income', 'housing', 'Rent Income from ' || v_property.name);
    END IF;

    -- Update Lease
    UPDATE public.leases SET last_rent_paid_at = NOW() WHERE id = p_lease_id;

    -- Log
    INSERT INTO public.rent_payment_log (
        lease_id, tenant_id, amount_paid, rent_portion, utility_portion, tax_portion, landlord_portion
    ) VALUES (
        p_lease_id, v_user_id, v_total_cost, v_property.rent_amount, v_property.utility_cost, v_tax, 
        CASE WHEN v_property.owner_id IS NOT NULL THEN v_landlord_share ELSE 0 END
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

