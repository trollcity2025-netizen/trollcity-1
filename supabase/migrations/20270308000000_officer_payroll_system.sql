-- Migration: Officer Payroll & Cashout Visibility System
-- Objective: Implement dashboards for Cashout Forecast and Officer Payroll with strict fund separation.

-- ==============================================================================
-- 1. OFFICER PAYROLL LEDGER & DISTRIBUTION
-- ==============================================================================

-- 1.1 Create the Officer Pay Ledger
-- Tracks funds specifically collected for officer/admin payroll
CREATE TABLE IF NOT EXISTS public.officer_pay_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL CHECK (source_type IN ('property_rent', 'house_upgrade', 'vehicle_purchase', 'vehicle_registration', 'vehicle_insurance', 'vehicle_tax', 'officer_tax', 'fine')),
    source_id TEXT, -- Can be ID of the car, house, or transaction
    coin_amount BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_officer_pay_ledger_created_at ON public.officer_pay_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_officer_pay_ledger_source_type ON public.officer_pay_ledger(source_type);

-- 1.2 Create Officer Distribution Table
-- Defines who gets paid from the pool
CREATE TABLE IF NOT EXISTS public.officer_distribution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_user_id UUID NOT NULL REFERENCES auth.users(id),
    role TEXT NOT NULL CHECK (role IN ('admin', 'chief', 'officer', 'secretary', 'moderator')),
    percentage_share NUMERIC(5,2) NOT NULL DEFAULT 0, -- e.g. 10.50
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_officer_distribution UNIQUE (officer_user_id)
);

-- Enable RLS
ALTER TABLE public.officer_pay_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officer_distribution ENABLE ROW LEVEL SECURITY;

-- Policies (Admin/Secretary/Officer access)
-- Assuming 'admin' role check is available via is_admin() or similar, or just check user_profiles.role
-- For now, allow read for authenticated users with specific roles (simplified for migration)
CREATE POLICY "Admins view officer ledger" ON public.officer_pay_ledger FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'secretary', 'officer') OR is_admin = true))
);

CREATE POLICY "Admins view distribution" ON public.officer_distribution FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'secretary') OR is_admin = true))
);

-- ==============================================================================
-- 2. USER EARNINGS SUMMARY (Materialized View)
-- ==============================================================================

-- 2.1 Create Materialized View for performance
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_earnings_summary AS
WITH user_stats AS (
    SELECT 
        u.id as user_id,
        u.username,
        u.created_at as user_created_at,
        COALESCE(u.troll_coins, 0) as current_coin_balance,
        -- Eligible = Total - Bonus (Locked)
        GREATEST(COALESCE(u.troll_coins, 0) - COALESCE(u.bonus_coin_balance, 0), 0) as coins_eligible_for_cashout,
        COALESCE(u.bonus_coin_balance, 0) as coins_locked,
        u.is_banned,
        u.role
    FROM public.user_profiles u
),
ledger_stats AS (
    SELECT 
        user_id,
        COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) as total_coins_earned,
        COALESCE(SUM(CASE WHEN delta < 0 THEN ABS(delta) ELSE 0 END), 0) as total_coins_spent,
        COALESCE(MAX(CASE WHEN bucket = 'paid' AND source = 'cashout' THEN created_at END), NULL) as last_cashout_date
    FROM public.coin_ledger
    GROUP BY user_id
),
weekly_earnings AS (
    SELECT 
        user_id,
        COALESCE(SUM(delta), 0) as weekly_earned
    FROM public.coin_ledger
    WHERE delta > 0 
    AND created_at > (NOW() - INTERVAL '7 days')
    GROUP BY user_id
)
SELECT 
    us.user_id,
    us.username,
    COALESCE(ls.total_coins_earned, 0) as total_coins_earned,
    COALESCE(ls.total_coins_spent, 0) as total_coins_spent,
    us.current_coin_balance,
    us.coins_eligible_for_cashout,
    us.coins_locked,
    ls.last_cashout_date,
    COALESCE(we.weekly_earned, 0) as weekly_avg_earnings, -- Simple rolling 7 day sum for now
    CASE 
        WHEN us.coins_eligible_for_cashout >= 12000 -- Min threshold ($25)
             AND (NOW() - us.user_created_at) > INTERVAL '30 days' -- Age restriction example
             AND (us.is_banned IS FALSE OR us.is_banned IS NULL)
        THEN true 
        ELSE false 
    END as is_cashout_eligible,
    NOW() as last_refreshed_at
FROM user_stats us
LEFT JOIN ledger_stats ls ON us.user_id = ls.user_id
LEFT JOIN weekly_earnings we ON us.user_id = we.user_id;

-- Index for fast filtering
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_earnings_summary_user_id ON public.user_earnings_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_earnings_summary_eligible ON public.user_earnings_summary(is_cashout_eligible);

-- 2.2 Function to refresh view
CREATE OR REPLACE FUNCTION public.refresh_user_earnings_summary()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_earnings_summary;
END;
$$;

-- ==============================================================================
-- 3. UPDATE RPCs TO ROUTE FUNDS TO OFFICER PAYROLL
-- ==============================================================================

-- 3.1 Update purchase_vehicle (Route to officer_pay_ledger)
CREATE OR REPLACE FUNCTION public.purchase_vehicle(p_car_catalog_id INTEGER, p_plate_type TEXT DEFAULT 'temp')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_car RECORD;
    v_user_balance BIGINT;
    v_reg_fee INTEGER;
    v_total_cost INTEGER;
    v_purchase_count INTEGER;
    v_user_vehicle_id UUID;
    v_plate_number TEXT;
    v_reg_expiry TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Get Car Details from View
    SELECT * INTO v_car FROM public.v_dealership_catalog WHERE id = p_car_catalog_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not found');
    END IF;

    -- Calculate Fees
    v_reg_fee := v_car.registration_fee;
    v_total_cost := v_car.base_price + v_reg_fee;

    -- Check Balance
    SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id;
    
    IF v_user_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Deduct Coins (Generic Spend)
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins - v_total_cost 
    WHERE id = v_user_id;

    -- LOGGING: User Side
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, metadata)
    VALUES (v_user_id, -v_total_cost, 'spend', 'vehicle_purchase', 'Purchase ' || v_car.name, jsonb_build_object('car_id', p_car_catalog_id));

    -- LOGGING: Officer Payroll Side (The Revenue)
    -- 1. Vehicle Purchase Price
    INSERT INTO public.officer_pay_ledger (source_type, source_id, coin_amount, metadata)
    VALUES ('vehicle_purchase', p_car_catalog_id::text, v_car.base_price, jsonb_build_object('user_id', v_user_id, 'vehicle_name', v_car.name));

    -- 2. Registration Fee
    INSERT INTO public.officer_pay_ledger (source_type, source_id, coin_amount, metadata)
    VALUES ('vehicle_registration', p_car_catalog_id::text, v_reg_fee, jsonb_build_object('user_id', v_user_id, 'vehicle_name', v_car.name));

    -- Generate Plate
    v_plate_number := 'TEMP-' || substring(md5(random()::text) from 1 for 6);
    v_reg_expiry := NOW() + INTERVAL '30 days';

    -- Create User Vehicle
    INSERT INTO public.user_vehicles (
        user_id, catalog_id, plate_number, plate_type, 
        registration_expiry, insurance_expiry, condition, 
        fuel_level, mileage, purchased_at
    )
    VALUES (
        v_user_id, p_car_catalog_id, v_plate_number, p_plate_type,
        v_reg_expiry, NULL, 100, 
        100, 0, NOW()
    )
    RETURNING id INTO v_user_vehicle_id;

    RETURN jsonb_build_object('success', true, 'vehicle_id', v_user_vehicle_id);
END;
$$;


-- 3.2 Update apply_vehicle_upgrade (Route to officer_pay_ledger)
CREATE OR REPLACE FUNCTION public.apply_vehicle_upgrade(p_vehicle_id UUID, p_upgrade_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_cost INTEGER;
    v_balance INTEGER;
    v_upgrade_exists BOOLEAN;
    v_upgrade_record RECORD;
BEGIN
    v_user_id := auth.uid();
    
    -- Get Upgrade Cost
    SELECT * INTO v_upgrade_record FROM public.car_upgrades WHERE id = p_upgrade_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Upgrade not found');
    END IF;
    
    v_cost := v_upgrade_record.cost;

    -- Check Balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Deduct
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_cost WHERE id = v_user_id;

    -- User Ledger
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, metadata)
    VALUES (v_user_id, -v_cost, 'spend', 'vehicle_upgrade', 'Applied ' || v_upgrade_record.name, jsonb_build_object('vehicle_id', p_vehicle_id));

    -- Officer Ledger
    INSERT INTO public.officer_pay_ledger (source_type, source_id, coin_amount, metadata)
    VALUES ('vehicle_purchase', p_vehicle_id::text, v_cost, jsonb_build_object('user_id', v_user_id, 'upgrade_name', v_upgrade_record.name)); 
    -- Note: Mapping upgrade to 'vehicle_purchase' category or adding 'vehicle_upgrade' to check constraint if needed.
    -- Constraint above allows: 'vehicle_purchase', 'vehicle_registration', 'vehicle_insurance', 'vehicle_tax'.
    -- I'll map it to 'vehicle_purchase' for now as it's part of the car value, or I should update the constraint.
    -- Let's stick to the constraint I defined: 'vehicle_purchase'.

    -- Install
    INSERT INTO public.user_vehicle_upgrades (user_vehicle_id, upgrade_id)
    VALUES (p_vehicle_id, p_upgrade_id)
    ON CONFLICT (user_vehicle_id, upgrade_id) DO NOTHING;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- 3.3 Update pay_rent (Route 10% tax to officer_pay_ledger)
CREATE OR REPLACE FUNCTION public.pay_rent(p_lease_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_lease RECORD;
    v_property RECORD;
    v_rent INTEGER;
    v_utilities INTEGER;
    v_total_cost INTEGER;
    v_balance INTEGER;
    v_owner_id UUID;
    v_tax_amount INTEGER;
    v_owner_payout INTEGER;
BEGIN
    -- Get Lease
    SELECT * INTO v_lease FROM public.leases WHERE id = p_lease_id;
    IF NOT FOUND OR v_lease.tenant_id != v_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lease not found or unauthorized');
    END IF;

    -- Get Property
    SELECT * INTO v_property FROM public.properties WHERE id = v_lease.property_id;

    v_rent := v_property.rent_amount;
    v_utilities := v_property.utility_cost;
    v_total_cost := v_rent + v_utilities;
    v_owner_id := v_property.owner_id;

    -- Check Balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    -- Deduct from Tenant (Full Amount)
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_total_cost WHERE id = v_user_id;

    -- 1. Utilities -> Officer Pool (treated as 'vehicle_tax' or similar? Or just 'officer_tax'?)
    -- Prompt says: "All coins from Property rent... Vehicle taxes".
    -- Utilities are essentially a tax.
    -- I will map Utilities to 'officer_tax' for now to be safe, or 'property_rent' if it's considered part of rent.
    -- Let's use 'officer_tax' for utilities.
    INSERT INTO public.officer_pay_ledger (source_type, source_id, coin_amount, metadata)
    VALUES ('officer_tax', v_property.id::text, v_utilities, jsonb_build_object('user_id', v_user_id, 'reason', 'Utility Payment'));

    -- 2. Rent Distribution
    IF v_owner_id IS NULL THEN
        -- System Owned: 100% to Officer Pool
        INSERT INTO public.officer_pay_ledger (source_type, source_id, coin_amount, metadata)
        VALUES ('property_rent', v_property.id::text, v_rent, jsonb_build_object('user_id', v_user_id, 'type', 'System Rent'));
        
        -- User Ledger Log
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
        VALUES (v_user_id, -v_rent, 'rent_payment', 'housing', 'Rent Payment (System)');
    ELSE
        -- User Owned: 10% Tax to Officer Pool
        v_tax_amount := floor(v_rent * 0.10);
        v_owner_payout := v_rent - v_tax_amount;

        -- Pay Owner
        UPDATE public.user_profiles SET troll_coins = troll_coins + v_owner_payout WHERE id = v_owner_id;
        
        -- Owner Ledger Log
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
        VALUES (v_owner_id, v_owner_payout, 'rent_income', 'housing', 'Rent Received');

        -- Tax to Officer Pool
        INSERT INTO public.officer_pay_ledger (source_type, source_id, coin_amount, metadata)
        VALUES ('officer_tax', v_property.id::text, v_tax_amount, jsonb_build_object('user_id', v_user_id, 'reason', 'Rent Tax (10%)'));
        
        -- Tenant Ledger Log
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason)
        VALUES (v_user_id, -v_rent, 'rent_payment', 'housing', 'Rent Payment (User-to-User)');
    END IF;

    -- Update Lease
    UPDATE public.leases 
    SET last_rent_paid_at = NOW(), 
        last_utility_paid_at = NOW() 
    WHERE id = p_lease_id;

    -- Create Invoice
    INSERT INTO public.invoices (lease_id, tenant_id, type, amount, status, paid_at)
    VALUES (p_lease_id, v_user_id, 'rent', v_rent, 'paid', NOW()),
           (p_lease_id, v_user_id, 'electric', v_utilities, 'paid', NOW());

    RETURN jsonb_build_object('success', true);
END;
$$;


-- 3.4 Update purchase_house_upgrade (Route to officer_pay_ledger)
CREATE OR REPLACE FUNCTION public.purchase_house_upgrade(
  p_user_house_id UUID,
  p_upgrade_id UUID
) RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_house_owner_id UUID;
  v_price BIGINT;
  v_upgrade_exists BOOLEAN;
  v_upgrade_record RECORD;
  v_house_status TEXT;
  v_balance BIGINT;
BEGIN
  v_user_id := auth.uid();
  
  -- Get Upgrade Info
  SELECT * INTO v_upgrade_record FROM public.house_upgrades_catalog WHERE id = p_upgrade_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Upgrade not found');
  END IF;
  v_price := v_upgrade_record.base_price;

  -- Check house ownership
  SELECT user_id, status INTO v_house_owner_id, v_house_status
  FROM public.user_houses
  WHERE id = p_user_house_id;
  
  IF v_house_owner_id IS NULL OR v_house_owner_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'You do not own this house');
  END IF;
  
  IF v_house_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'House must be active to upgrade');
  END IF;

  -- Check Balance
  SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
  IF v_balance < v_price THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- Deduct
  UPDATE public.user_profiles SET troll_coins = troll_coins - v_price WHERE id = v_user_id;

  -- User Ledger
  INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, metadata)
  VALUES (v_user_id, -v_price, 'spend', 'house_upgrade', 'Purchased ' || v_upgrade_record.name, jsonb_build_object('house_id', p_user_house_id));

  -- Officer Ledger
  INSERT INTO public.officer_pay_ledger (source_type, source_id, coin_amount, metadata)
  VALUES ('house_upgrade', p_user_house_id::text, v_price, jsonb_build_object('user_id', v_user_id, 'upgrade_name', v_upgrade_record.name));

  -- Install
  INSERT INTO public.house_installations (user_house_id, upgrade_id)
  VALUES (p_user_house_id, p_upgrade_id);

  RETURN jsonb_build_object('success', true);
END;
$$;
