-- Fix2 & Fix3: Housing RPCs and Revenue Distribution Logic

-- 1. Ensure is_landlord column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_landlord') THEN
        ALTER TABLE public.user_profiles ADD COLUMN is_landlord BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Purchase Landlord License
CREATE OR REPLACE FUNCTION public.purchase_landlord_license()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_cost INTEGER := 7000;
    v_balance INTEGER;
BEGIN
    -- Check if already landlord
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_user_id AND is_landlord = true) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already a landlord');
    END IF;

    -- Check balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    -- Deduct coins
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_cost WHERE id = v_user_id;

    -- Record transaction (to Admin Pool)
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
    VALUES (v_user_id, -v_cost, 'purchase', 'landlord_license', 'Landlord License Purchase', 'out');

    -- Grant License
    UPDATE public.user_profiles SET is_landlord = true WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Sign Lease (Initial Payment)
CREATE OR REPLACE FUNCTION public.sign_lease(p_property_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_property RECORD;
    v_total_cost INTEGER;
    v_rent INTEGER;
    v_utilities INTEGER;
    v_balance INTEGER;
    v_owner_id UUID;
    v_tax_amount INTEGER;
    v_owner_payout INTEGER;
    v_lease_id UUID;
BEGIN
    -- Get Property
    SELECT * INTO v_property FROM public.properties WHERE id = p_property_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not found');
    END IF;

    IF v_property.is_for_rent = false THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not for rent');
    END IF;

    -- Calculate Cost (1st Month Rent + Utilities)
    v_rent := v_property.rent_amount;
    v_utilities := v_property.utility_cost;
    v_total_cost := v_rent + v_utilities;
    v_owner_id := v_property.owner_id;

    -- Check Balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds for first month rent + utilities');
    END IF;

    -- Deduct from Tenant
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_total_cost WHERE id = v_user_id;

    -- Distribute Revenue
    -- 1. Utilities -> Admin Pool (100%)
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
    VALUES (v_user_id, -v_utilities, 'utility_payment', 'housing', 'Initial Utility Payment', 'out');

    -- 2. Rent -> Split
    IF v_owner_id IS NULL THEN
        -- System owned: 100% to Admin Pool
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
        VALUES (v_user_id, -v_rent, 'rent_payment', 'housing', 'Initial Rent Payment (System)', 'out');
    ELSE
        -- User owned: 10% Tax to Officer Pool, 90% to Owner
        v_tax_amount := floor(v_rent * 0.10);
        v_owner_payout := v_rent - v_tax_amount;

        -- Pay Owner
        UPDATE public.user_profiles SET troll_coins = troll_coins + v_owner_payout WHERE id = v_owner_id;
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
        VALUES (v_owner_id, v_owner_payout, 'rent_income', 'housing', 'Rent Received', 'in');

        -- Tax to Officer Pool
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
        VALUES (v_user_id, -v_tax_amount, 'officer_tax', 'housing', 'Rent Tax (10%)', 'out');
    END IF;

    -- Create Lease
    INSERT INTO public.leases (property_id, tenant_id, start_date, rent_due_day, last_rent_paid_at, last_utility_paid_at, status)
    VALUES (p_property_id, v_user_id, NOW(), EXTRACT(DAY FROM NOW()), NOW(), NOW(), 'active')
    RETURNING id INTO v_lease_id;

    -- Create Invoice Record
    INSERT INTO public.invoices (lease_id, tenant_id, type, amount, status, paid_at)
    VALUES (v_lease_id, v_user_id, 'rent', v_rent, 'paid', NOW()),
           (v_lease_id, v_user_id, 'electric', v_utilities, 'paid', NOW());

    -- Update Property Status
    UPDATE public.properties SET is_for_rent = false WHERE id = p_property_id;

    RETURN jsonb_build_object('success', true, 'lease_id', v_lease_id);
END;
$$;

-- 4. Pay Rent (Recurring)
CREATE OR REPLACE FUNCTION public.pay_rent(p_lease_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_lease RECORD;
    v_property RECORD;
    v_total_cost INTEGER;
    v_rent INTEGER;
    v_utilities INTEGER;
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

    -- Deduct from Tenant
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_total_cost WHERE id = v_user_id;

    -- Distribute Revenue (Same logic as Sign Lease)
    -- 1. Utilities -> Admin Pool
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
    VALUES (v_user_id, -v_utilities, 'utility_payment', 'housing', 'Utility Payment', 'out');

    -- 2. Rent -> Split
    IF v_owner_id IS NULL THEN
        -- System owned
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
        VALUES (v_user_id, -v_rent, 'rent_payment', 'housing', 'Rent Payment (System)', 'out');
    ELSE
        -- User owned: 10% Tax
        v_tax_amount := floor(v_rent * 0.10);
        v_owner_payout := v_rent - v_tax_amount;

        -- Pay Owner
        UPDATE public.user_profiles SET troll_coins = troll_coins + v_owner_payout WHERE id = v_owner_id;
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
        VALUES (v_owner_id, v_owner_payout, 'rent_income', 'housing', 'Rent Received', 'in');

        -- Tax Ledger Entry
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
        VALUES (v_user_id, -v_tax_amount, 'officer_tax', 'housing', 'Rent Tax (10%)', 'out');
    END IF;

    -- Update Lease
    UPDATE public.leases 
    SET last_rent_paid_at = NOW(), 
        last_utility_paid_at = NOW() 
    WHERE id = p_lease_id;

    -- Create Invoice Record
    INSERT INTO public.invoices (lease_id, tenant_id, type, amount, status, paid_at)
    VALUES (p_lease_id, v_user_id, 'rent', v_rent, 'paid', NOW()),
           (p_lease_id, v_user_id, 'electric', v_utilities, 'paid', NOW());

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Buy Property with Loan
CREATE OR REPLACE FUNCTION public.buy_property_with_loan(p_property_id UUID, p_down_payment INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_property RECORD;
    v_price INTEGER;
    v_loan_amount INTEGER;
    v_min_down INTEGER;
    v_balance INTEGER;
    v_loan_id UUID;
    v_prev_owner_id UUID;
BEGIN
    SELECT * INTO v_property FROM public.properties WHERE id = p_property_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not found');
    END IF;
    
    v_price := v_property.price;
    v_min_down := ceil(v_price * 0.10); -- 10% minimum

    IF p_down_payment < v_min_down THEN
        RETURN jsonb_build_object('success', false, 'error', 'Down payment must be at least 10%');
    END IF;

    -- Check Balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < p_down_payment THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds for down payment');
    END IF;

    v_loan_amount := v_price - p_down_payment;
    v_prev_owner_id := v_property.owner_id;

    -- Deduct Down Payment
    UPDATE public.user_profiles SET troll_coins = troll_coins - p_down_payment WHERE id = v_user_id;

    -- Create Loan
    INSERT INTO public.bank_loans (user_id, loan_type, amount, remaining_balance, status)
    VALUES (v_user_id, 'rent_loan', v_loan_amount, v_loan_amount, 'active')
    RETURNING id INTO v_loan_id;

    -- Transfer Ownership
    UPDATE public.properties SET owner_id = v_user_id, is_for_rent = true, is_for_sale = false WHERE id = p_property_id;

    -- Pay Previous Owner (if exists)
    IF v_prev_owner_id IS NOT NULL THEN
        UPDATE public.user_profiles SET troll_coins = troll_coins + v_price WHERE id = v_prev_owner_id;
        -- Log sale
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
        VALUES (v_prev_owner_id, v_price, 'sale', 'housing', 'Property Sold (Bank Financed)', 'in');
    END IF;

    RETURN jsonb_build_object('success', true, 'loan_id', v_loan_id);
END;
$;

-- ADDING PRICE COLUMN FIRST
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS price INTEGER DEFAULT 100000;

-- Redefine Buy Function properly (after column is added)
CREATE OR REPLACE FUNCTION public.buy_property_with_loan(p_property_id UUID, p_down_payment INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_property RECORD;
    v_price INTEGER;
    v_loan_amount INTEGER;
    v_min_down INTEGER;
    v_balance INTEGER;
    v_loan_id UUID;
    v_prev_owner_id UUID;
BEGIN
    SELECT * INTO v_property FROM public.properties WHERE id = p_property_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not found');
    END IF;

    -- Use price column
    v_price := v_property.price;
    v_min_down := ceil(v_price * 0.10); -- 10% minimum

    IF p_down_payment < v_min_down THEN
        RETURN jsonb_build_object('success', false, 'error', 'Down payment must be at least 10%');
    END IF;

    -- Check Balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < p_down_payment THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds for down payment');
    END IF;

    v_loan_amount := v_price - p_down_payment;
    v_prev_owner_id := v_property.owner_id;

    -- Deduct Down Payment
    UPDATE public.user_profiles SET troll_coins = troll_coins - p_down_payment WHERE id = v_user_id;

    -- Create Loan
    INSERT INTO public.bank_loans (user_id, loan_type, amount, remaining_balance, status, property_id)
    VALUES (v_user_id, 'rent_loan', v_loan_amount, v_loan_amount, 'active', p_property_id)
    RETURNING id INTO v_loan_id;

    -- Transfer Ownership
    UPDATE public.properties SET owner_id = v_user_id, is_for_rent = true, is_for_sale = false WHERE id = p_property_id;

    -- Pay Previous Owner (if exists)
    IF v_prev_owner_id IS NOT NULL THEN
        UPDATE public.user_profiles SET troll_coins = troll_coins + v_price WHERE id = v_prev_owner_id;
        -- Log sale
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
        VALUES (v_prev_owner_id, v_price, 'sale', 'housing', 'Property Sold (Bank Financed)', 'in');
    END IF;

    RETURN jsonb_build_object('success', true, 'loan_id', v_loan_id);
END;
$;

-- 6. Pay Loan
CREATE OR REPLACE FUNCTION public.pay_loan(p_loan_id UUID, p_amount INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_loan RECORD;
    v_balance INTEGER;
BEGIN
    SELECT * INTO v_loan FROM public.bank_loans WHERE id = p_loan_id;
    IF NOT FOUND OR v_loan.user_id != v_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
    END IF;

    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    IF p_amount > v_loan.remaining_balance THEN
        p_amount := v_loan.remaining_balance;
    END IF;

    -- Deduct
    UPDATE public.user_profiles SET troll_coins = troll_coins - p_amount WHERE id = v_user_id;
    
    -- Update Loan
    UPDATE public.bank_loans 
    SET remaining_balance = remaining_balance - p_amount,
        status = CASE WHEN remaining_balance - p_amount <= 0 THEN 'paid' ELSE 'active' END
    WHERE id = p_loan_id;

    -- Ledger
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
    VALUES (v_user_id, -p_amount, 'loan_repayment', 'housing', 'Loan Repayment', 'out');

    RETURN jsonb_build_object('success', true);
END;
$$;
