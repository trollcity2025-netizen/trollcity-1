-- KTAuto Dealership Inventory + Unique Model Rotation

-- 1. Dealership inventory table (isolated from core vehicle tables)
CREATE TABLE IF NOT EXISTS public.dealership_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership TEXT NOT NULL DEFAULT 'KTAuto',
    catalog_id INTEGER NOT NULL REFERENCES public.vehicles_catalog(id),
    quantity INTEGER NOT NULL DEFAULT 50,
    max_quantity INTEGER NOT NULL DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'active', -- active, retired
    created_at TIMESTAMPTZ DEFAULT now(),
    retired_at TIMESTAMPTZ,
    CONSTRAINT dealership_inventory_qty_check CHECK (quantity >= 0),
    CONSTRAINT dealership_inventory_max_check CHECK (max_quantity > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS dealership_inventory_unique
ON public.dealership_inventory (dealership, catalog_id);

CREATE INDEX IF NOT EXISTS dealership_inventory_dealership_status
ON public.dealership_inventory (dealership, status);

-- 2. Pool of unique models used to replace sold-out inventory
CREATE TABLE IF NOT EXISTS public.dealership_vehicle_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    created_at TIMESTAMPTZ DEFAULT now(),
    used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS dealership_vehicle_pool_name_unique
ON public.dealership_vehicle_pool (name);

-- 3. Seed new non-copyright vehicle models into vehicles_catalog
INSERT INTO public.vehicles_catalog (name, tier, style, price, speed, armor, color_from, color_to, image, model_url)
SELECT v.name, v.tier, v.style, v.price, v.speed, v.armor, v.color_from, v.color_to, v.image, v.model_url
FROM (
    VALUES
        ('KT Ember Hatch', 'Starter', 'Hatchback', 6500, 42, 18, '#f97316', '#fb7185', '/assets/cars/vehicle_3_original.png', '/models/vehicles/kt_ember_hatch.glb'),
        ('KT Ridge Runner', 'Street', 'Crossover', 11000, 58, 28, '#22c55e', '#16a34a', '/assets/cars/vehicle_5_original.png', '/models/vehicles/kt_ridge_runner.glb'),
        ('KT Nightline GT', 'Mid', 'Coupe', 19500, 76, 32, '#111827', '#0f172a', '/assets/cars/vehicle_1_original.png', '/models/vehicles/kt_nightline_gt.glb'),
        ('KT Pulse Courier', 'Street', 'Bike', 9000, 62, 16, '#38bdf8', '#0ea5e9', '/assets/cars/vehicle_4_original.png', '/models/vehicles/kt_pulse_courier.glb'),
        ('KT Harbor Glide', 'Mid', 'Sedan', 17500, 68, 30, '#64748b', '#94a3b8', '/assets/cars/vehicle_7_original.png', '/models/vehicles/kt_harbor_glide.glb'),
        ('KT Auric LX', 'Luxury', 'Sedan', 82000, 90, 48, '#fde047', '#f59e0b', '/assets/cars/vehicle_8_original.png', '/models/vehicles/kt_auric_lx.glb'),
        ('KT Stormbreak', 'Super', 'Supercar', 165000, 118, 40, '#7c3aed', '#6366f1', '/assets/cars/vehicle_6_original.png', '/models/vehicles/kt_stormbreak.glb'),
        ('KT Quarry Hauler', 'Mid', 'Utility', 24000, 64, 55, '#a16207', '#78350f', '/assets/cars/vehicle_2_original.png', '/models/vehicles/kt_quarry_hauler.glb'),
        ('KT Lucent S', 'Luxury', 'Coupe', 74000, 88, 36, '#0ea5e9', '#38bdf8', '/assets/cars/phantom_x.png', '/models/vehicles/kt_lucent_s.glb'),
        ('KT Zephyr R', 'Super', 'Hyper', 210000, 132, 44, '#a855f7', '#ec4899', '/assets/cars/urban_drift_r.png', '/models/vehicles/kt_zephyr_r.glb')
) AS v(name, tier, style, price, speed, armor, color_from, color_to, image, model_url)
WHERE NOT EXISTS (
    SELECT 1 FROM public.vehicles_catalog vc WHERE vc.name = v.name
);

-- 4. Seed the replacement pool (unique models not yet in catalog)
INSERT INTO public.dealership_vehicle_pool (name, tier, style, price, speed, armor, color_from, color_to, image, model_url)
SELECT v.name, v.tier, v.style, v.price, v.speed, v.armor, v.color_from, v.color_to, v.image, v.model_url
FROM (
    VALUES
        ('KT Solar Drift', 'Street', 'Coupe', 12500, 63, 24, '#f59e0b', '#facc15', '/assets/cars/vehicle_3_original.png', '/models/vehicles/kt_solar_drift.glb'),
        ('KT Ironwind', 'Mid', 'Sedan', 20500, 74, 34, '#6b7280', '#111827', '/assets/cars/vehicle_7_original.png', '/models/vehicles/kt_ironwind.glb'),
        ('KT Prism GT', 'Luxury', 'Gran Tourer', 98000, 96, 46, '#22d3ee', '#0ea5e9', '/assets/cars/vehicle_5_original.png', '/models/vehicles/kt_prism_gt.glb'),
        ('KT Wraithline', 'Super', 'Supercar', 175000, 122, 40, '#4c1d95', '#8b5cf6', '/assets/cars/vehicle_6_original.png', '/models/vehicles/kt_wraithline.glb'),
        ('KT Embertrail', 'Street', 'Hatchback', 10000, 59, 20, '#f97316', '#fb7185', '/assets/cars/vehicle_4_original.png', '/models/vehicles/kt_embertrail.glb'),
        ('KT Summit AX', 'Mid', 'SUV', 26000, 72, 50, '#1f2937', '#0f172a', '/assets/cars/vehicle_2_original.png', '/models/vehicles/kt_summit_ax.glb'),
        ('KT Monarch V', 'Luxury', 'Sedan', 92000, 92, 48, '#e2e8f0', '#94a3b8', '/assets/cars/vehicle_8_original.png', '/models/vehicles/kt_monarch_v.glb'),
        ('KT Aurora Blade', 'Super', 'Hyper', 230000, 135, 42, '#a855f7', '#ec4899', '/assets/cars/urban_drift_r.png', '/models/vehicles/kt_aurora_blade.glb'),
        ('KT Bayline Eco', 'Starter', 'Compact', 5500, 40, 18, '#22c55e', '#86efac', '/assets/cars/troll_compact_s1.png', '/models/vehicles/kt_bayline_eco.glb'),
        ('KT Nightpulse', 'Mid', 'Coupe', 21500, 78, 30, '#0f172a', '#1e293b', '/assets/cars/phantom_x.png', '/models/vehicles/kt_nightpulse.glb')
) AS v(name, tier, style, price, speed, armor, color_from, color_to, image, model_url)
WHERE NOT EXISTS (
    SELECT 1 FROM public.dealership_vehicle_pool dp WHERE dp.name = v.name
)
AND NOT EXISTS (
    SELECT 1 FROM public.vehicles_catalog vc WHERE vc.name = v.name
);

-- 5. Seed dealership inventory (50 each, only if missing)
INSERT INTO public.dealership_inventory (dealership, catalog_id, quantity, max_quantity)
SELECT 'KTAuto', vc.id, 50, 50
FROM public.vehicles_catalog vc
WHERE NOT EXISTS (
    SELECT 1 FROM public.dealership_inventory di
    WHERE di.dealership = 'KTAuto' AND di.catalog_id = vc.id
);

-- 6. Replace sold-out model with a new unique model from pool
CREATE OR REPLACE FUNCTION public.dealership_replace_sold_out(
    p_inventory_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inventory RECORD;
    v_pool RECORD;
    v_new_catalog_id INTEGER;
    v_unique_suffix TEXT;
BEGIN
    SELECT * INTO v_inventory
    FROM public.dealership_inventory
    WHERE id = p_inventory_id
    FOR UPDATE;

    IF v_inventory IS NULL OR v_inventory.status <> 'active' THEN
        RETURN;
    END IF;

    UPDATE public.dealership_inventory
    SET status = 'retired', retired_at = now()
    WHERE id = p_inventory_id;

    -- Pick next unused pool item
    SELECT * INTO v_pool
    FROM public.dealership_vehicle_pool
    WHERE used_at IS NULL
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF v_pool IS NULL THEN
        -- Fallback: generate a unique placeholder model (never repeats)
        v_unique_suffix := replace(gen_random_uuid()::text, '-', '')::text;

        INSERT INTO public.vehicles_catalog (name, tier, style, price, speed, armor, color_from, color_to, image, model_url)
        VALUES (
            'KT Limited ' || substring(v_unique_suffix, 1, 6),
            'Mid',
            'Limited',
            30000,
            72,
            40,
            '#64748b',
            '#94a3b8',
            '/assets/cars/vehicle_7_original.png',
            '/models/vehicles/kt_limited_' || substring(v_unique_suffix, 1, 10) || '.glb'
        )
        RETURNING id INTO v_new_catalog_id;
    ELSE
        INSERT INTO public.vehicles_catalog (name, tier, style, price, speed, armor, color_from, color_to, image, model_url)
        VALUES (
            v_pool.name,
            v_pool.tier,
            v_pool.style,
            v_pool.price,
            v_pool.speed,
            v_pool.armor,
            v_pool.color_from,
            v_pool.color_to,
            v_pool.image,
            v_pool.model_url
        )
        RETURNING id INTO v_new_catalog_id;

        UPDATE public.dealership_vehicle_pool
        SET used_at = now()
        WHERE id = v_pool.id;
    END IF;

    INSERT INTO public.dealership_inventory (dealership, catalog_id, quantity, max_quantity)
    VALUES (v_inventory.dealership, v_new_catalog_id, v_inventory.max_quantity, v_inventory.max_quantity);
END;
$$;

-- 7. Inventory helpers
CREATE OR REPLACE FUNCTION public.dealership_decrement_inventory(
    p_dealership TEXT,
    p_catalog_id INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inventory RECORD;
    v_new_qty INTEGER;
BEGIN
    SELECT * INTO v_inventory
    FROM public.dealership_inventory
    WHERE dealership = p_dealership
      AND catalog_id = p_catalog_id
      AND status = 'active'
    FOR UPDATE;

    IF v_inventory IS NULL OR v_inventory.quantity <= 0 THEN
        RETURN FALSE;
    END IF;

    UPDATE public.dealership_inventory
    SET quantity = quantity - 1
    WHERE id = v_inventory.id
    RETURNING quantity INTO v_new_qty;

    IF v_new_qty <= 0 THEN
        PERFORM public.dealership_replace_sold_out(v_inventory.id);
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.dealership_increment_inventory(
    p_dealership TEXT,
    p_catalog_id INTEGER,
    p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inventory RECORD;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN FALSE;
    END IF;

    SELECT * INTO v_inventory
    FROM public.dealership_inventory
    WHERE dealership = p_dealership
      AND catalog_id = p_catalog_id
      AND status = 'active'
    FOR UPDATE;

    IF v_inventory IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.dealership_inventory
    SET quantity = LEAST(quantity + p_amount, max_quantity)
    WHERE id = v_inventory.id;

    RETURN TRUE;
END;
$$;

-- 8. Update dealership view to only show active inventory
DROP VIEW IF EXISTS public.v_dealership_catalog;

CREATE OR REPLACE VIEW public.v_dealership_catalog AS
SELECT
    vc.id,
    vc.name,
    vc.tier,
    vc.price as base_price,
    vc.image as image_url,
    vc.model_url,
    di.quantity as quantity,
    CASE
        WHEN vc.tier = 'Starter' THEN 10
        WHEN vc.tier = 'Street' THEN 20
        WHEN vc.tier = 'Mid' THEN 30
        WHEN vc.tier = 'Luxury' THEN 50
        WHEN vc.tier = 'Super' THEN 100
        WHEN vc.tier = 'Hyper' THEN 120
        WHEN vc.tier = 'Legendary' THEN 150
        ELSE 10
    END as insurance_rate_bps,
    CASE
        WHEN vc.tier = 'Starter' THEN 100
        WHEN vc.tier = 'Street' THEN 200
        WHEN vc.tier = 'Mid' THEN 500
        WHEN vc.tier = 'Luxury' THEN 1000
        WHEN vc.tier = 'Super' THEN 5000
        WHEN vc.tier = 'Hyper' THEN 7000
        WHEN vc.tier = 'Legendary' THEN 10000
        ELSE 100
    END as registration_fee,
    4 as exposure_level
FROM public.dealership_inventory di
JOIN public.vehicles_catalog vc ON vc.id = di.catalog_id
WHERE di.dealership = 'KTAuto'
  AND di.status = 'active'
  AND di.quantity > 0;

GRANT SELECT ON public.v_dealership_catalog TO authenticated;
GRANT SELECT ON public.v_dealership_catalog TO anon;

-- 9. Update purchase_from_ktauto to enforce dealership inventory
DROP FUNCTION IF EXISTS public.purchase_from_ktauto(INTEGER, TEXT);

CREATE OR REPLACE FUNCTION purchase_from_ktauto(
    p_catalog_id INTEGER,
    p_plate_type TEXT DEFAULT 'temp',
    p_use_credit BOOLEAN DEFAULT FALSE
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
    v_credit_success BOOLEAN;
    v_inventory_ok BOOLEAN;
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

    -- 3. Verify Inventory (lock row to prevent race)
    PERFORM 1
    FROM public.dealership_inventory
    WHERE dealership = 'KTAuto'
      AND catalog_id = p_catalog_id
      AND status = 'active'
      AND quantity > 0
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle out of stock');
    END IF;

    -- 4. Check Purchase Limit
    SELECT COUNT(*) INTO v_purchase_count 
    FROM public.vehicle_transactions 
    WHERE user_id = v_user_id 
      AND type = 'purchase' 
      AND created_at > NOW() - INTERVAL '30 days';

    IF v_purchase_count >= 25 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Monthly purchase limit reached (25 cars/month)');
    END IF;

    -- 5. Calculate Costs
    SELECT amount INTO v_title_fee FROM public.tmv_fee_schedule WHERE fee_type = 'title_issue';
    
    IF p_plate_type = 'hard' THEN
        SELECT amount INTO v_reg_fee FROM public.tmv_fee_schedule WHERE fee_type = 'registration_new_hard';
        v_reg_expiry := NOW() + INTERVAL '60 days';
    ELSE
        SELECT amount INTO v_reg_fee FROM public.tmv_fee_schedule WHERE fee_type = 'registration_new_temp';
        v_reg_expiry := NOW() + INTERVAL '7 days';
    END IF;

    v_total_cost := v_car.price + COALESCE(v_title_fee, 500) + COALESCE(v_reg_fee, 200);

    -- 6. Payment Processing
    IF p_use_credit THEN
        v_credit_success := public.try_pay_with_credit_card(
            v_user_id, 
            v_total_cost::BIGINT, 
            'vehicle_purchase', 
            jsonb_build_object('car_id', p_catalog_id, 'plate_type', p_plate_type)
        );
        
        IF NOT v_credit_success THEN
             RETURN jsonb_build_object('success', false, 'message', 'Credit card declined (Limit exceeded or restricted)');
        END IF;
    ELSE
        -- Cash Payment
        SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
        
        IF v_user_balance < v_total_cost THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds: ' || v_total_cost || ' required');
        END IF;

        UPDATE public.user_profiles 
        SET troll_coins = troll_coins - v_total_cost 
        WHERE id = v_user_id;
    END IF;

    -- 7. Create User Vehicle
    INSERT INTO public.user_vehicles (user_id, catalog_id)
    VALUES (v_user_id, p_catalog_id)
    RETURNING id INTO v_user_vehicle_id;

    -- 8. Generate Plate
    v_plate_number := public.generate_license_plate();

    -- 9. Create Title
    INSERT INTO public.vehicle_titles (user_vehicle_id, user_id, status)
    VALUES (v_user_vehicle_id, v_user_id, 'clean');

    -- 10. Create Registration
    INSERT INTO public.vehicle_registrations (user_vehicle_id, plate_number, plate_type, expires_at, status)
    VALUES (v_user_vehicle_id, v_plate_number, p_plate_type, v_reg_expiry, 'active');

    -- 11. Create Insurance (Unpaid)
    INSERT INTO public.vehicle_insurance_policies (user_vehicle_id, status)
    VALUES (v_user_vehicle_id, 'unpaid');

    -- 12. Decrement Inventory (after successful purchase)
    v_inventory_ok := public.dealership_decrement_inventory('KTAuto', p_catalog_id);
    IF NOT v_inventory_ok THEN
        RAISE EXCEPTION 'Vehicle out of stock';
    END IF;

    -- 13. Log Transaction
    INSERT INTO public.vehicle_transactions (user_id, user_vehicle_id, type, amount, details)
    VALUES (
        v_user_id, 
        v_user_vehicle_id, 
        'purchase', 
        v_total_cost, 
        jsonb_build_object(
            'car_name', v_car.name, 
            'plate', v_plate_number, 
            'payment_method', CASE WHEN p_use_credit THEN 'credit_card' ELSE 'cash' END
        )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Vehicle purchased successfully', 'vehicle_id', v_user_vehicle_id);
END;
$$;

-- 10. Update sell_vehicle to restock dealership when active
-- Ensure vehicle_transactions FK does not block deleting user_vehicles
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'vehicle_transactions_user_vehicle_id_fkey'
          AND table_name = 'vehicle_transactions'
    ) THEN
        ALTER TABLE public.vehicle_transactions
        DROP CONSTRAINT vehicle_transactions_user_vehicle_id_fkey;

        ALTER TABLE public.vehicle_transactions
        ADD CONSTRAINT vehicle_transactions_user_vehicle_id_fkey
        FOREIGN KEY (user_vehicle_id)
        REFERENCES public.user_vehicles(id)
        ON DELETE SET NULL;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sell_vehicle(p_user_vehicle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_vehicle RECORD;
    v_catalog RECORD;
    v_sell_price INTEGER;
    v_restocked BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Check authentication
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Get vehicle and verify ownership
    SELECT * INTO v_vehicle FROM public.user_vehicles 
    WHERE id = p_user_vehicle_id AND user_id = v_user_id;
    
    IF v_vehicle IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not found or not owned by you');
    END IF;

    -- Get catalog details for pricing
    SELECT * INTO v_catalog FROM public.vehicles_catalog WHERE id = v_vehicle.catalog_id;
    
    -- Calculate sell price (50% of base price)
    v_sell_price := FLOOR(v_catalog.price * 0.5);

    -- Restock dealership if model is still active
    v_restocked := public.dealership_increment_inventory('KTAuto', v_vehicle.catalog_id, 1);

    -- Delete vehicle (Cascades to titles, registrations, insurance due to FK constraints)
    DELETE FROM public.user_vehicles WHERE id = p_user_vehicle_id;

    -- Add Coins
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins + v_sell_price 
    WHERE id = v_user_id;

    -- Log Transaction
    INSERT INTO public.vehicle_transactions (user_id, type, amount, details)
    VALUES (
        v_user_id, 
        'sale', 
        v_sell_price, 
        jsonb_build_object(
            'vehicle_id', p_user_vehicle_id,
            'catalog_id', v_vehicle.catalog_id,
            'car_name', v_catalog.name,
            'reason', 'User sold to dealer',
            'restocked', v_restocked
        )
    );

    -- Coin Transaction Log
    INSERT INTO public.coin_transactions (user_id, amount, type, description)
    VALUES (
        v_user_id, 
        v_sell_price, 
        'sale', 
        'Sold ' || v_catalog.name || ' to KTAuto'
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Vehicle sold for ' || v_sell_price || ' coins',
        'amount', v_sell_price,
        'restocked', v_restocked
    );
END;
$$;
