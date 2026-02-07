
-- Rebuild TMV System (User Vehicles, Titles, Registrations, Insurance)
-- Cleans up old tables and establishes a server-authoritative flow.

-- 1. Drop old tables if they exist (Clean Slate as requested)
DROP TABLE IF EXISTS public.vehicle_insurance_policies CASCADE;
DROP TABLE IF EXISTS public.vehicle_registrations CASCADE;
DROP TABLE IF EXISTS public.vehicle_titles CASCADE;
DROP TABLE IF EXISTS public.user_vehicles CASCADE;
DROP TABLE IF EXISTS public.vehicles_catalog CASCADE;
DROP TABLE IF EXISTS public.tmv_fee_schedule CASCADE;
DROP TABLE IF EXISTS public.vehicle_transactions CASCADE;
DROP TABLE IF EXISTS public.tmv_actions CASCADE;
DROP TABLE IF EXISTS public.user_driver_licenses CASCADE;
DROP TABLE IF EXISTS public.vehicle_listings CASCADE;

-- 2. Create Tables

-- Vehicles Catalog (The Source of Truth for Prices and Stats)
CREATE TABLE public.vehicles_catalog (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    tier TEXT NOT NULL,
    style TEXT,
    price INTEGER NOT NULL,
    speed INTEGER NOT NULL,
    armor INTEGER NOT NULL,
    color_from TEXT,
    color_to TEXT,
    image TEXT,
    model_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Vehicles (The physical car instance)
CREATE TABLE public.user_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    catalog_id INTEGER NOT NULL REFERENCES public.vehicles_catalog(id),
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    condition INTEGER DEFAULT 100, -- 0-100%
    mods JSONB DEFAULT '{}'::jsonb, -- Engine, Handling, Cosmetic upgrades
    is_impounded BOOLEAN DEFAULT FALSE,
    impounded_at TIMESTAMPTZ,
    impound_reason TEXT,
    CONSTRAINT condition_check CHECK (condition >= 0 AND condition <= 100)
);

-- Vehicle Titles (Proof of Ownership)
CREATE TABLE public.vehicle_titles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_vehicle_id UUID NOT NULL REFERENCES public.user_vehicles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id), -- Owner on title
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'clean', -- clean, salvage, rebuilt
    UNIQUE(user_vehicle_id) -- One title per vehicle
);

-- Vehicle Registrations (Plates)
CREATE TABLE public.vehicle_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_vehicle_id UUID NOT NULL REFERENCES public.user_vehicles(id) ON DELETE CASCADE,
    plate_number TEXT NOT NULL UNIQUE,
    plate_type TEXT NOT NULL DEFAULT 'temp', -- temp, hard, custom
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' -- active, expired, suspended
);

-- Vehicle Insurance Policies
CREATE TABLE public.vehicle_insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_vehicle_id UUID NOT NULL REFERENCES public.user_vehicles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'Troll Mutual',
    premium_amount INTEGER NOT NULL DEFAULT 2000,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Null means inactive/unpaid if we treat it that way, or set to past
    status TEXT NOT NULL DEFAULT 'unpaid', -- active, unpaid, lapsed
    UNIQUE(user_vehicle_id)
);

-- Vehicle Transactions (Audit Log)
CREATE TABLE public.vehicle_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id),
    user_vehicle_id UUID REFERENCES public.user_vehicles(id),
    type TEXT NOT NULL, -- purchase, sale, upgrade, insurance_payment, registration_renew, fee
    amount INTEGER NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TMV Fee Schedule (Configurable Fees)
CREATE TABLE public.tmv_fee_schedule (
    fee_type TEXT PRIMARY KEY,
    amount INTEGER NOT NULL
);

-- TMV Actions (Staff Enforcement Log)
CREATE TABLE public.tmv_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_user_id UUID NOT NULL REFERENCES public.user_profiles(id),
    actor_id UUID REFERENCES public.user_profiles(id), -- Staff ID
    action_type TEXT NOT NULL, -- fine, impound, suspend_license, warn
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Driver Licenses
CREATE TABLE public.user_driver_licenses (
    user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'valid', -- valid, suspended, revoked
    suspended_until TIMESTAMPTZ,
    points INTEGER DEFAULT 0,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicle Listings (Marketplace)
CREATE TABLE public.vehicle_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_vehicle_id UUID NOT NULL REFERENCES public.user_vehicles(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.user_profiles(id),
    price INTEGER NOT NULL,
    listed_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active', -- active, sold, cancelled
    UNIQUE(user_vehicle_id) -- Only one active listing per car
);


-- 3. Enable RLS

ALTER TABLE public.vehicles_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmv_fee_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmv_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_driver_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_listings ENABLE ROW LEVEL SECURITY;

-- Public Read Policies
CREATE POLICY "Public read catalog" ON public.vehicles_catalog FOR SELECT USING (true);
CREATE POLICY "Public read fees" ON public.tmv_fee_schedule FOR SELECT USING (true);
CREATE POLICY "Public read listings" ON public.vehicle_listings FOR SELECT USING (status = 'active');

-- Owner Policies
CREATE POLICY "Users view own vehicles" ON public.user_vehicles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users view own titles" ON public.vehicle_titles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users view own registrations" ON public.vehicle_registrations FOR SELECT USING (user_vehicle_id IN (SELECT id FROM public.user_vehicles WHERE user_id = auth.uid()));
CREATE POLICY "Users view own insurance" ON public.vehicle_insurance_policies FOR SELECT USING (user_vehicle_id IN (SELECT id FROM public.user_vehicles WHERE user_id = auth.uid()));
CREATE POLICY "Users view own transactions" ON public.vehicle_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users view own license" ON public.user_driver_licenses FOR SELECT USING (auth.uid() = user_id);

-- Broadcast Visibility (Public can read basic status if needed, but usually handled via RPC to avoid exposing everything)
-- We will rely on `get_broadcast_vehicle_status` RPC for public viewing to be safe.


-- 4. Seed Data

-- Fee Schedule
INSERT INTO public.tmv_fee_schedule (fee_type, amount) VALUES
('title_issue', 500),
('title_transfer', 1000),
('registration_new_temp', 200),
('registration_new_hard', 2000),
('registration_renew_temp', 200),
('registration_renew_hard', 2000),
('insurance_premium', 2000),
('plate_change', 20);

-- Catalog (Populated from src/data/vehicles.ts)
INSERT INTO public.vehicles_catalog (id, name, tier, style, price, speed, armor, color_from, color_to, image, model_url) VALUES
(1, 'Troll Compact S1', 'Starter', 'Compact modern starter sedan', 5000, 40, 20, '#38bdf8', '#22c55e', '/assets/cars/troll_compact_s1.png', '/models/vehicles/troll_compact_s1.glb'),
(2, 'Midline XR', 'Mid', 'Mid-size SUV / crossover', 12000, 60, 35, '#fbbf24', '#f87171', '/assets/cars/midline_xr.png', '/models/vehicles/midline_xr.glb'),
(3, 'Urban Drift R', 'Mid', 'Aggressive street tuner coupe', 18000, 75, 30, '#a855f7', '#ec4899', '/assets/cars/urban_drift_r.png', '/models/vehicles/urban_drift_r.glb'),
(4, 'Ironclad GT', 'Luxury', 'Heavy luxury muscle car', 45000, 85, 60, '#94a3b8', '#475569', '/assets/cars/ironclad_gt.png', '/models/vehicles/ironclad_gt.glb'),
(5, 'Vanta LX', 'Luxury', 'High-end performance motorcycle', 60000, 92, 35, '#1e293b', '#000000', '/assets/cars/vanta_lx.png', '/models/vehicles/vanta_lx.glb'),
(6, 'Phantom X', 'Super', 'Stealth supercar', 150000, 110, 40, '#4c1d95', '#8b5cf6', '/assets/cars/phantom_x.png', '/models/vehicles/phantom_x.glb'),
(7, 'Obsidian One Apex', 'Elite / Hyper', 'Ultra-elite hypercar', 180000, 120, 45, '#111827', '#0f172a', '/assets/cars/vehicle_1_original.png', '/models/vehicles/obsidian_one_apex.glb'),
(8, 'Titan Enforcer', 'Legendary / Armored', 'Heavily armored enforcement vehicle', 500000, 60, 100, '#0b0f1a', '#111827', '/assets/cars/vehicle_2_original.png', '/models/vehicles/titan_enforcer.glb'),
(9, 'Neon Hatch S', 'Street', 'Compact hatchback for city runs', 8000, 48, 22, '#22d3ee', '#3b82f6', '/assets/cars/vehicle_3_original.png', '/models/vehicles/neon_hatch_s.glb'),
(10, 'Courier Spark Bike', 'Street', 'Delivery bike built for fast runs', 7000, 55, 16, '#f59e0b', '#f97316', '/assets/cars/vehicle_4_original.png', '/models/vehicles/courier_spark_bike.glb'),
(11, 'Apex Trail SUV', 'Mid', 'Sport SUV with rugged stance', 22000, 70, 45, '#60a5fa', '#1d4ed8', '/assets/cars/vehicle_5_original.png', '/models/vehicles/apex_trail_suv.glb'),
(12, 'Quantum Veil', 'Super', 'Experimental prototype hypercar', 220000, 130, 38, '#7c3aed', '#ec4899', '/assets/cars/vehicle_6_original.png', '/models/vehicles/quantum_veil.glb'),
(13, 'Driftline Pulse Bike', 'Mid', 'Drift-ready performance bike', 16000, 78, 20, '#06b6d4', '#3b82f6', '/assets/cars/vehicle_7_original.png', '/models/vehicles/driftline_pulse_bike.glb'),
(14, 'Regal Meridian', 'Luxury', 'Executive luxury sedan', 85000, 88, 50, '#0f172a', '#334155', '/assets/cars/vehicle_8_original.png', '/models/vehicles/regal_meridian.glb'),
(15, 'Luxe Voyager', 'Luxury', 'Luxury cruiser bike', 78000, 86, 32, '#1f2937', '#111827', '/assets/cars/vehicle_1_original.png', '/models/vehicles/luxe_voyager.glb'),
(16, 'Eclipse Seraph', 'Super', 'Exotic supercar', 260000, 138, 42, '#312e81', '#9333ea', '/assets/cars/vehicle_6_original.png', '/models/vehicles/eclipse_seraph.glb')
ON CONFLICT (id) DO UPDATE SET
name = EXCLUDED.name,
price = EXCLUDED.price,
image = EXCLUDED.image,
model_url = EXCLUDED.model_url;


-- 5. Helper Function: Generate Plate
CREATE OR REPLACE FUNCTION generate_license_plate()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
    exists_check INTEGER;
BEGIN
    LOOP
        result := '';
        FOR i IN 1..7 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        END LOOP;
        
        -- Check uniqueness
        SELECT 1 INTO exists_check FROM public.vehicle_registrations WHERE plate_number = result;
        IF exists_check IS NULL THEN
            RETURN result;
        END IF;
    END LOOP;
END;
$$;


-- 6. RPC: Purchase from KTAuto
CREATE OR REPLACE FUNCTION purchase_from_ktauto(
    p_catalog_id INTEGER,
    p_plate_type TEXT DEFAULT 'temp' -- 'temp' or 'hard'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_car RECORD;
    v_user_balance BIGINT;
    v_title_fee INTEGER;
    v_reg_fee INTEGER;
    v_total_cost INTEGER;
    v_purchase_count INTEGER;
    v_user_vehicle_id UUID;
    v_plate_number TEXT;
    v_reg_expiry TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Validate User
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- 2. Get Car Details
    SELECT * INTO v_car FROM public.vehicles_catalog WHERE id = p_catalog_id;
    IF v_car IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not found');
    END IF;

    -- 3. Check Purchase Limit (25 per rolling 30 days)
    SELECT COUNT(*) INTO v_purchase_count 
    FROM public.vehicle_transactions 
    WHERE user_id = v_user_id 
      AND type = 'purchase' 
      AND created_at > NOW() - INTERVAL '30 days';

    IF v_purchase_count >= 25 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Monthly purchase limit reached (25 cars/month)');
    END IF;

    -- 4. Calculate Costs
    SELECT amount INTO v_title_fee FROM public.tmv_fee_schedule WHERE fee_type = 'title_issue';
    
    IF p_plate_type = 'hard' THEN
        SELECT amount INTO v_reg_fee FROM public.tmv_fee_schedule WHERE fee_type = 'registration_new_hard';
        v_reg_expiry := NOW() + INTERVAL '60 days';
    ELSE
        SELECT amount INTO v_reg_fee FROM public.tmv_fee_schedule WHERE fee_type = 'registration_new_temp';
        v_reg_expiry := NOW() + INTERVAL '7 days';
    END IF;

    v_total_cost := v_car.price + COALESCE(v_title_fee, 500) + COALESCE(v_reg_fee, 200);

    -- 5. Check Balance & Deduct
    SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
    
    IF v_user_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds: ' || v_total_cost || ' required');
    END IF;

    UPDATE public.user_profiles 
    SET troll_coins = troll_coins - v_total_cost 
    WHERE id = v_user_id;

    -- 6. Create User Vehicle
    INSERT INTO public.user_vehicles (user_id, catalog_id)
    VALUES (v_user_id, p_catalog_id)
    RETURNING id INTO v_user_vehicle_id;

    -- 7. Create Title
    INSERT INTO public.vehicle_titles (user_vehicle_id, user_id)
    VALUES (v_user_vehicle_id, v_user_id);

    -- 8. Create Registration (Plate)
    v_plate_number := generate_license_plate();
    INSERT INTO public.vehicle_registrations (user_vehicle_id, plate_number, plate_type, expires_at)
    VALUES (v_user_vehicle_id, v_plate_number, p_plate_type, v_reg_expiry);

    -- 9. Create Insurance Policy (Unpaid)
    INSERT INTO public.vehicle_insurance_policies (user_vehicle_id, status)
    VALUES (v_user_vehicle_id, 'unpaid');

    -- 10. Log Transactions
    -- Vehicle Transaction
    INSERT INTO public.vehicle_transactions (user_id, user_vehicle_id, type, amount, details)
    VALUES (
        v_user_id, 
        v_user_vehicle_id, 
        'purchase', 
        v_total_cost, 
        jsonb_build_object(
            'car_price', v_car.price,
            'title_fee', v_title_fee,
            'reg_fee', v_reg_fee,
            'plate_type', p_plate_type,
            'car_name', v_car.name
        )
    );

    -- Coin Transaction (for central history)
    INSERT INTO public.coin_transactions (user_id, amount, type, description)
    VALUES (
        v_user_id, 
        -v_total_cost, 
        'purchase', 
        'Bought ' || v_car.name || ' from KTAuto'
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Vehicle purchased successfully',
        'vehicle_id', v_user_vehicle_id,
        'plate', v_plate_number,
        'cost', v_total_cost
    );
END;
$$;


-- 7. RPC: Pay Insurance
CREATE OR REPLACE FUNCTION pay_vehicle_insurance(
    p_user_vehicle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_policy RECORD;
    v_fee INTEGER;
    v_user_balance BIGINT;
BEGIN
    v_user_id := auth.uid();

    SELECT * INTO v_policy FROM public.vehicle_insurance_policies WHERE user_vehicle_id = p_user_vehicle_id;
    IF v_policy IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Policy not found');
    END IF;

    -- Verify ownership indirectly via RLS or explicit check? Explicit is safer for RPC.
    PERFORM 1 FROM public.user_vehicles WHERE id = p_user_vehicle_id AND user_id = v_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not owned by you');
    END IF;

    SELECT amount INTO v_fee FROM public.tmv_fee_schedule WHERE fee_type = 'insurance_premium';
    v_fee := COALESCE(v_fee, 2000);

    -- Check balance
    SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
    IF v_user_balance < v_fee THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Deduct
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_fee WHERE id = v_user_id;

    -- Update Policy
    UPDATE public.vehicle_insurance_policies
    SET status = 'active',
        expires_at = NOW() + INTERVAL '30 days'
    WHERE id = v_policy.id;

    -- Log
    INSERT INTO public.vehicle_transactions (user_id, user_vehicle_id, type, amount, details)
    VALUES (v_user_id, p_user_vehicle_id, 'insurance_payment', v_fee, jsonb_build_object('period', '30 days'));

    INSERT INTO public.coin_transactions (user_id, amount, type, description)
    VALUES (v_user_id, -v_fee, 'purchase', 'Paid Vehicle Insurance');

    RETURN jsonb_build_object('success', true, 'message', 'Insurance paid');
END;
$$;


-- 8. RPC: Get Broadcast Vehicle Status (Publicly accessible safe data)
CREATE OR REPLACE FUNCTION get_broadcast_vehicle_status(
    p_target_user_id UUID
)
RETURNS TABLE (
    vehicle_name TEXT,
    plate_number TEXT,
    plate_type TEXT,
    reg_status TEXT,
    ins_status TEXT,
    license_status TEXT,
    is_impounded BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vc.name as vehicle_name,
        vr.plate_number,
        vr.plate_type,
        CASE 
            WHEN vr.expires_at < NOW() THEN 'expired'
            ELSE vr.status 
        END as reg_status,
        vi.status as ins_status,
        COALESCE(udl.status, 'none') as license_status,
        uv.is_impounded
    FROM public.user_vehicles uv
    JOIN public.vehicles_catalog vc ON uv.catalog_id = vc.id
    LEFT JOIN public.vehicle_registrations vr ON uv.id = vr.user_vehicle_id
    LEFT JOIN public.vehicle_insurance_policies vi ON uv.id = vi.user_vehicle_id
    LEFT JOIN public.user_driver_licenses udl ON uv.user_id = udl.user_id
    WHERE uv.user_id = p_target_user_id
    ORDER BY uv.purchased_at DESC
    LIMIT 1; -- Show most recent car for now, or maybe the one they are "driving" (future)
END;
$$;
