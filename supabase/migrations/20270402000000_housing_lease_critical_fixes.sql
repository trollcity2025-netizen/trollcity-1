-- Critical Housing/Lease System Fixes
-- Fixes sign_lease, pay_rent RPCs, adds eviction support, and lease agreement tracking

-- 0. Add missing columns to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS housing_status TEXT DEFAULT 'homeless' CHECK (housing_status IN ('homeless', 'rented', 'owned'));
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS home_type TEXT;

-- 1. Fix sign_lease: handle NULL utility_cost, use electric_cost/water_cost
CREATE OR REPLACE FUNCTION sign_lease(p_property_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property RECORD;
  v_user_id UUID := auth.uid();
  v_rent NUMERIC;
  v_electric NUMERIC;
  v_water NUMERIC;
  v_utilities NUMERIC;
  v_total_cost NUMERIC;
  v_balance NUMERIC;
  v_existing_lease_id UUID;
  v_active_tenants INT;
  v_lease_id UUID;
BEGIN
  -- Get property
  SELECT * INTO v_property FROM public.properties WHERE id = p_property_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Property not found');
  END IF;

  -- Check if user already has an active lease on THIS property
  SELECT id INTO v_existing_lease_id FROM public.leases
    WHERE tenant_id = v_user_id AND property_id = p_property_id AND status = 'active';
  IF v_existing_lease_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a lease on this property');
  END IF;

  -- Check occupancy
  SELECT COUNT(*) INTO v_active_tenants FROM public.leases
    WHERE property_id = p_property_id AND status = 'active';
  IF v_active_tenants >= COALESCE(v_property.max_tenants, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Property is fully occupied');
  END IF;

  -- Calculate costs (handle NULLs)
  v_rent := COALESCE(v_property.rent_amount, 0);
  v_electric := COALESCE(v_property.electric_cost, CEIL(COALESCE(v_property.utility_cost, 0) / 2.0));
  v_water := COALESCE(v_property.water_cost, FLOOR(COALESCE(v_property.utility_cost, 0) / 2.0));
  v_utilities := v_electric + v_water;
  v_total_cost := v_rent + v_utilities;

  -- Check balance
  SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
  IF COALESCE(v_balance, 0) < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Need ' || v_total_cost || ' coins.');
  END IF;

  -- Deduct coins
  UPDATE public.user_profiles SET troll_coins = troll_coins - v_total_cost WHERE id = v_user_id;

  -- Create lease
  INSERT INTO public.leases (property_id, tenant_id, start_date, rent_due_day, last_rent_paid_at, status)
    VALUES (p_property_id, v_user_id, NOW(), EXTRACT(DAY FROM NOW())::INT, NOW(), 'active')
    RETURNING id INTO v_lease_id;

  -- Record transaction
  INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
    VALUES (v_user_id, 'rent', -v_total_cost, 'Lease signed: first month rent + utilities', NOW());

  -- Update user housing status
  UPDATE public.user_profiles SET housing_status = 'rented', home_type = 'apartment' WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'lease_id', v_lease_id, 'total_cost', v_total_cost);
END;
$$;

-- 2. Fix pay_rent: handle NULL utility_cost, create proper invoices
CREATE OR REPLACE FUNCTION pay_rent(p_lease_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease RECORD;
  v_property RECORD;
  v_user_id UUID := auth.uid();
  v_rent NUMERIC;
  v_electric NUMERIC;
  v_water NUMERIC;
  v_total_cost NUMERIC;
  v_balance NUMERIC;
BEGIN
  -- Get lease - first check if lease exists at all
  SELECT * INTO v_lease FROM public.leases WHERE id = p_lease_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lease not found. The lease ID does not exist.');
  END IF;
  
  -- Check if lease is active
  IF v_lease.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lease is not active. Current status: ' || v_lease.status || '. Rent can only be collected from active leases.');
  END IF;

  -- Get property
  SELECT * INTO v_property FROM public.properties WHERE id = v_lease.property_id;

  -- Calculate costs
  v_rent := COALESCE(v_property.rent_amount, 0);
  v_electric := COALESCE(v_property.electric_cost, CEIL(COALESCE(v_property.utility_cost, 0) / 2.0));
  v_water := COALESCE(v_property.water_cost, FLOOR(COALESCE(v_property.utility_cost, 0) / 2.0));
  v_total_cost := v_rent + v_electric + v_water;

  -- Check balance
  SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
  IF COALESCE(v_balance, 0) < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Need ' || v_total_cost || ' coins.');
  END IF;

  -- Deduct coins
  UPDATE public.user_profiles SET troll_coins = troll_coins - v_total_cost WHERE id = v_user_id;

  -- Update lease
  UPDATE public.leases SET last_rent_paid_at = NOW() WHERE id = p_lease_id;

  -- Create invoices for tracking
  INSERT INTO public.invoices (lease_id, type, amount, status, created_at)
    VALUES (p_lease_id, 'rent', v_rent, 'paid', NOW()),
           (p_lease_id, 'electric', v_electric, 'paid', NOW()),
           (p_lease_id, 'water', v_water, 'paid', NOW());

  -- Record transaction
  INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
    VALUES (v_user_id, 'rent', -v_total_cost, 'Rent payment for lease ' || p_lease_id, NOW());

  -- Pay landlord if property has an owner
  IF v_property.owner_id IS NOT NULL THEN
    UPDATE public.user_profiles SET troll_coins = troll_coins + v_rent WHERE id = v_property.owner_id;
    INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
      VALUES (v_property.owner_id, 'rent_income', v_rent, 'Rent income from lease ' || p_lease_id, NOW());
  END IF;

  RETURN jsonb_build_object('success', true, 'total_paid', v_total_cost);
END;
$$;

-- 3. Add eviction support
CREATE OR REPLACE FUNCTION evict_tenant(p_lease_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease RECORD;
  v_property RECORD;
  v_is_owner BOOLEAN := false;
  v_is_admin BOOLEAN := false;
BEGIN
  -- Get lease - first check if lease exists at all
  SELECT * INTO v_lease FROM public.leases WHERE id = p_lease_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lease not found. The lease ID does not exist.');
  END IF;
  
  -- Check if lease is active
  IF v_lease.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lease is not active. Current status: ' || v_lease.status || '. Rent can only be collected from active leases.');
  END IF;

  -- Get property and verify caller is the landlord
  SELECT * INTO v_property FROM public.properties WHERE id = v_lease.property_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Property not found for this lease');
  END IF;
  IF v_property.owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Property has no owner. Cannot collect rent.');
  END IF;
  IF v_property.owner_id != v_landlord_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not the owner of this property. Owner ID: ' || v_property.owner_id || ', Your ID: ' || v_landlord_id);
  END IF;

  -- Get property
  SELECT * INTO v_property FROM public.properties WHERE id = v_lease.property_id;

  -- Check if caller is property owner or admin
  v_is_owner := (v_property.owner_id = auth.uid());
  SELECT is_admin OR role = 'admin' INTO v_is_admin FROM public.user_profiles WHERE id = auth.uid();

  IF NOT (v_is_owner OR v_is_admin) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the property owner or admin can evict tenants');
  END IF;

  -- Check for active court case tied to this lease (prevent unauthorized eviction)
  -- If there IS a court case, eviction is allowed as part of court ruling
  -- If there is NO court case and no overdue rent, eviction is blocked
  IF NOT v_is_admin THEN
    -- Non-admin landlords can only evict if rent is overdue by 7+ days
    IF v_lease.last_rent_paid_at > NOW() - INTERVAL '7 days' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot evict: rent is not overdue. File a court case for other violations.');
    END IF;
  END IF;

  -- Evict: end lease
  UPDATE public.leases SET status = 'evicted' WHERE id = p_lease_id;

  -- Update tenant housing status
  UPDATE public.user_profiles SET housing_status = 'homeless', home_type = NULL WHERE id = v_lease.tenant_id;

  -- Make property available again
  UPDATE public.properties SET is_for_rent = true WHERE id = v_lease.property_id;

  -- Log the eviction
  INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
    VALUES (v_lease.tenant_id, 'eviction', 0, 'Evicted from property ' || v_property.name, NOW());

  RETURN jsonb_build_object('success', true, 'message', 'Tenant evicted successfully');
END;
$$;

-- 4. Create invoices table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID REFERENCES public.leases(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('rent', 'electric', 'water', 'late_fee')),
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Auto-deduction: scheduled function for rent/utilities due
CREATE OR REPLACE FUNCTION process_monthly_rent_due()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease RECORD;
  v_property RECORD;
  v_processed INT := 0;
  v_failed INT := 0;
BEGIN
  FOR v_lease IN
    SELECT l.* FROM public.leases l
    WHERE l.status = 'active'
      AND l.last_rent_paid_at < NOW() - INTERVAL '28 days'
  LOOP
    -- Get property
    SELECT * INTO v_property FROM public.properties WHERE id = v_lease.property_id;

    -- Mark lease as having overdue rent (eviction eligibility)
    -- The actual deduction happens when user clicks "Pay Rent"
    -- But we can auto-evict after 7 days overdue
    IF v_lease.last_rent_paid_at < NOW() - INTERVAL '35 days' THEN
      PERFORM evict_tenant(v_lease.id);
      v_failed := v_failed + 1;
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'processed', v_processed, 'evicted', v_failed);
END;
$$;

-- 6. Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoices"
  ON public.invoices FOR SELECT
  USING (lease_id IN (SELECT id FROM public.leases WHERE tenant_id = auth.uid()));

-- 7. Update housing_status for existing renters who have active leases but wrong status
UPDATE public.user_profiles up
SET housing_status = 'rented', home_type = 'apartment'
FROM public.leases l
WHERE l.tenant_id = up.id
  AND l.status = 'active'
  AND (up.housing_status IS NULL OR up.housing_status = 'homeless');

-- 8. Add collect_rent function for landlords to collect rent from tenants
CREATE OR REPLACE FUNCTION collect_rent(p_lease_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease RECORD;
  v_property RECORD;
  v_landlord_id UUID := auth.uid();
  v_rent NUMERIC;
  v_electric NUMERIC;
  v_water NUMERIC;
  v_total_cost NUMERIC;
  v_tenant_balance NUMERIC;
BEGIN
  -- Get lease - first check if lease exists at all
  SELECT * INTO v_lease FROM public.leases WHERE id = p_lease_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lease not found. The lease ID does not exist.');
  END IF;
  
  -- Check if lease is active
  IF v_lease.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lease is not active. Current status: ' || v_lease.status || '. Rent can only be collected from active leases.');
  END IF;

  -- Get property and verify caller is the landlord
  SELECT * INTO v_property FROM public.properties WHERE id = v_lease.property_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Property not found for this lease');
  END IF;
  IF v_property.owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Property has no owner. Cannot collect rent.');
  END IF;
  IF v_property.owner_id != v_landlord_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not the owner of this property. Owner ID: ' || v_property.owner_id || ', Your ID: ' || v_landlord_id);
  END IF;

  -- Calculate costs
  v_rent := COALESCE(v_property.rent_amount, 0);
  v_electric := COALESCE(v_property.electric_cost, CEIL(COALESCE(v_property.utility_cost, 0) / 2.0));
  v_water := COALESCE(v_property.water_cost, FLOOR(COALESCE(v_property.utility_cost, 0) / 2.0));
  v_total_cost := v_rent + v_electric + v_water;

  -- Check tenant balance
  SELECT troll_coins INTO v_tenant_balance FROM public.user_profiles WHERE id = v_lease.tenant_id;
  IF COALESCE(v_tenant_balance, 0) < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant has insufficient balance. Need ' || v_total_cost || ' coins.');
  END IF;

  -- Deduct coins from tenant
  UPDATE public.user_profiles SET troll_coins = troll_coins - v_total_cost WHERE id = v_lease.tenant_id;

  -- Update lease
  UPDATE public.leases SET last_rent_paid_at = NOW() WHERE id = p_lease_id;

  -- Create invoices for tracking
  INSERT INTO public.invoices (lease_id, tenant_id, type, amount, status, created_at)
    VALUES (p_lease_id, v_lease.tenant_id, 'rent', v_rent, 'paid', NOW()),
           (p_lease_id, v_lease.tenant_id, 'electric', v_electric, 'paid', NOW()),
           (p_lease_id, v_lease.tenant_id, 'water', v_water, 'paid', NOW());

  -- Record transaction for tenant
  INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
    VALUES (v_lease.tenant_id, 'rent', -v_total_cost, 'Rent payment for lease ' || p_lease_id, NOW());

  -- Pay landlord (full rent amount - no tax for manual collection)
  UPDATE public.user_profiles SET troll_coins = troll_coins + v_rent WHERE id = v_landlord_id;
  INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
    VALUES (v_landlord_id, 'rent_income', v_rent, 'Rent income from lease ' || p_lease_id, NOW());

  RETURN jsonb_build_object('success', true, 'total_collected', v_total_cost);
END;
$$;

-- 9. Add collect_house_rent function for legacy house_rentals
CREATE OR REPLACE FUNCTION collect_house_rent(p_rental_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rental RECORD;
  v_landlord_id UUID := auth.uid();
  v_total_cost NUMERIC;
  v_tenant_balance NUMERIC;
BEGIN
  -- Get rental
  SELECT * INTO v_rental FROM public.house_rentals WHERE id = p_rental_id AND landlord_user_id = v_landlord_id AND status IN ('active', 'late');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active rental not found');
  END IF;

  v_total_cost := v_rental.rent_amount;

  -- Check tenant balance
  SELECT troll_coins INTO v_tenant_balance FROM public.user_profiles WHERE id = v_rental.tenant_user_id;
  IF COALESCE(v_tenant_balance, 0) < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant has insufficient balance. Need ' || v_total_cost || ' coins.');
  END IF;

  -- Deduct coins from tenant
  UPDATE public.user_profiles SET troll_coins = troll_coins - v_total_cost WHERE id = v_rental.tenant_user_id;

  -- Update rental
  UPDATE public.house_rentals SET last_paid_at = NOW(), next_due_at = NOW() + INTERVAL '7 days', status = 'active' WHERE id = p_rental_id;

  -- Record transaction for tenant
  INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
    VALUES (v_rental.tenant_user_id, 'rent', -v_total_cost, 'Rent payment for house rental ' || p_rental_id, NOW());

  -- Pay landlord (90% - platform fee)
  DECLARE
    v_landlord_share NUMERIC := v_total_cost * 0.9;
  BEGIN
    UPDATE public.user_profiles SET troll_coins = troll_coins + v_landlord_share WHERE id = v_landlord_id;
    INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
      VALUES (v_landlord_id, 'rent_income', v_landlord_share, 'Rent income from house rental ' || p_rental_id, NOW());
  END;

  RETURN jsonb_build_object('success', true, 'total_collected', v_total_cost);
END;
$$;
