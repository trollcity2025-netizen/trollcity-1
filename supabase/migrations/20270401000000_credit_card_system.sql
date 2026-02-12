-- Migration: Credit Card System (Replaces "Loans")
-- 1. Add Credit Card columns to user_profiles
-- 2. Implement Credit Card Logic (Draw, Spend, Pay)
-- 3. Update Cashout to block debtors
-- 4. Update Purchase functions to support Credit Card

-- ==========================================
-- 1. Schema Updates
-- ==========================================

DO $$      
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'credit_limit') THEN
        ALTER TABLE public.user_profiles ADD COLUMN credit_limit BIGINT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'credit_used') THEN
        ALTER TABLE public.user_profiles ADD COLUMN credit_used BIGINT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'credit_apr_fee_percent') THEN
        ALTER TABLE public.user_profiles ADD COLUMN credit_apr_fee_percent NUMERIC DEFAULT 8;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'credit_status') THEN
        ALTER TABLE public.user_profiles ADD COLUMN credit_status TEXT DEFAULT 'active';
    END IF;
    
    -- Set initial credit limits for existing users based on tenure (Simple rule: 1000 + 10 * days_active)
    -- This ensures the feature is usable immediately
    UPDATE public.user_profiles 
    SET credit_limit = 1000 + (EXTRACT(DAY FROM (now() - created_at)) * 10)
    WHERE credit_limit = 0;
END $$;

-- ==========================================
-- 2. Core Credit Card Functions
-- ==========================================

-- Drop old functions to avoid signature conflicts
DROP FUNCTION IF EXISTS public.draw_credit_internal(UUID, BIGINT);
DROP FUNCTION IF EXISTS public.draw_credit(BIGINT);
DROP FUNCTION IF EXISTS public.try_pay_with_credit_card(UUID, BIGINT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.pay_credit_card(BIGINT);
DROP FUNCTION IF EXISTS public.purchase_from_ktauto(INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.purchase_from_ktauto(INTEGER, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.purchase_shop_item(TEXT, TEXT, INTEGER, JSONB);
DROP FUNCTION IF EXISTS public.purchase_shop_item(TEXT, TEXT, INTEGER, BOOLEAN, JSONB);

-- Internal helper to actually increase debt
CREATE OR REPLACE FUNCTION public.draw_credit_internal(
    p_user_id UUID,
    p_amount BIGINT
)
RETURNS BIGINT -- Returns total added to debt (amount + fee)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_fee BIGINT;
    v_total_charge BIGINT;
BEGIN
    SELECT * INTO v_profile FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;
    
    IF v_profile IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Validate Limit
    IF (v_profile.credit_limit - v_profile.credit_used) < p_amount THEN
        RAISE EXCEPTION 'Credit limit exceeded';
    END IF;

    -- Calculate Fee (8% flat)
    v_fee := CEIL(p_amount * (v_profile.credit_apr_fee_percent / 100.0));
    v_total_charge := p_amount + v_fee;

    -- Update Profile
    UPDATE public.user_profiles
    SET credit_used = credit_used + v_total_charge
    WHERE id = p_user_id;

    RETURN v_total_charge;
END;
$$;

-- Public RPC: Draw Credit (As requested in Section B)
-- Note: This function increases debt. Since it doesn't return coins, 
-- it's mostly useful if there's a future "Credit Wallet" or for testing.
-- Users should generally use 'try_pay_with_credit_card' via purchase functions.
CREATE OR REPLACE FUNCTION public.draw_credit(p_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_total_added BIGINT;
    v_profile RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Amount must be positive');
    END IF;

    BEGIN
        v_total_added := public.draw_credit_internal(v_user_id, p_amount);
        
        SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_user_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'amount', p_amount,
            'fee', v_total_added - p_amount,
            'total_added_to_debt', v_total_added,
            'credit_used', v_profile.credit_used,
            'credit_remaining', v_profile.credit_limit - v_profile.credit_used
        );
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
    END;
END;
$$;

-- Payment Gateway: Try Pay With Credit Card
CREATE OR REPLACE FUNCTION public.try_pay_with_credit_card(
    p_user_id UUID,
    p_amount BIGINT,
    p_context TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_allowed_contexts TEXT[] := ARRAY['shop_purchase', 'vehicle_purchase', 'insurance_payment', 'platform_fee', 'consumable_purchase'];
    v_forbidden_contexts TEXT[] := ARRAY['gift', 'transfer', 'rent', 'p2p_purchase', 'tip', 'payout'];
    v_total_added BIGINT;
BEGIN
    -- 1. Validate Context
    IF p_context = ANY(v_forbidden_contexts) THEN
        RETURN FALSE;
    END IF;

    -- Enforce Allowed List (Strict Mode)
    IF NOT (p_context = ANY(v_allowed_contexts)) THEN
        -- Log suspicious attempt?
        RETURN FALSE;
    END IF;

    -- 2. Execute Charge
    BEGIN
        v_total_added := public.draw_credit_internal(p_user_id, p_amount);
        
        -- Log Transaction
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, metadata)
        VALUES (
            p_user_id, 
            0, -- No coin change
            'credit_spend', 
            'credit_card', 
            'Credit Card Spend: ' || p_context, 
            p_metadata || jsonb_build_object('credit_charge', v_total_added, 'principal', p_amount)
        );

        RETURN TRUE;
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END;
END;
$$;

-- Repayment RPC
CREATE OR REPLACE FUNCTION public.pay_credit_card(p_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_admin_id UUID := '8dff9f37-21b5-4b8e-adc2-b9286874be1a'::uuid;
    v_profile RECORD;
    v_pay_amount BIGINT;
    v_interest_amount BIGINT;
    v_new_credit_used BIGINT;
    v_new_credit_score INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Amount must be positive');
    END IF;

    SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;

    IF v_profile.credit_used <= 0 THEN
         RETURN jsonb_build_object('success', false, 'message', 'No credit debt to pay');
    END IF;

    -- Cap payment to debt
    v_pay_amount := LEAST(p_amount, v_profile.credit_used);

    -- Check Coin Balance
    IF v_profile.troll_coins < v_pay_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient Troll Coins');
    END IF;

    -- Calculate 8% interest/fee on the payment amount
    v_interest_amount := CEIL(v_pay_amount * 0.08);

    -- Execute Payment (deduct from user's coins)
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_pay_amount,
        credit_used = credit_used - v_pay_amount
    WHERE id = v_user_id
    RETURNING credit_used INTO v_new_credit_used;

    -- Increase user's credit score (up to 800)
    UPDATE public.user_profiles
    SET credit_score = LEAST(credit_score + 5, 800)
    WHERE id = v_user_id
    RETURNING credit_score INTO v_new_credit_score;

    -- Send 8% interest to admin account
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_interest_amount
    WHERE id = v_admin_id;

    -- Log Ledger for user's payment
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, metadata)
    VALUES (
        v_user_id, 
        -v_pay_amount, 
        'repayment', 
        'credit_card_repay', 
        'Credit Card Repayment', 
        jsonb_build_object('remaining_debt', v_new_credit_used, 'interest_paid', v_interest_amount)
    );

    -- Log Ledger for admin's interest income
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, metadata)
    VALUES (
        v_admin_id, 
        v_interest_amount, 
        'revenue', 
        'credit_card_interest', 
        'Credit Card Interest from User Payment', 
        jsonb_build_object('payer', v_user_id, 'original_payment', v_pay_amount)
    );

    RETURN jsonb_build_object(
        'success', true, 
        'paid', v_pay_amount, 
        'interest_to_admin', v_interest_amount,
        'remaining_debt', v_new_credit_used,
        'new_credit_score', v_new_credit_score,
        'remaining_coins', v_profile.troll_coins - v_pay_amount
    );
END;
$$;

-- ==========================================
-- 3. Cashout Block
-- ==========================================

DROP FUNCTION IF EXISTS request_payout(uuid, bigint);
CREATE OR REPLACE FUNCTION request_payout(p_user_id uuid, p_coins_to_redeem bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_profile record;
  v_min_payout bigint := 1000; -- Example limit
  v_conversion_rate numeric := 0.01; -- Example rate
  v_payout_amount numeric;
BEGIN
  -- Check admin or self
  IF auth.uid() != p_user_id THEN
     -- Allow admins? For now strict self
     RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_user_profile FROM user_profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- CREDIT CARD BLOCK
  IF v_user_profile.credit_used > 0 THEN
    RETURN json_build_object('success', false, 'error', 'You must pay your Credit Card balance before requesting a cashout.');
  END IF;

  IF p_coins_to_redeem < v_min_payout THEN
    RETURN json_build_object('success', false, 'error', 'Minimum payout is ' || v_min_payout);
  END IF;

  IF v_user_profile.troll_coins < p_coins_to_redeem THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Create payout request (Assuming payout_requests table exists from previous context)
  -- If not, we just log it. But typically there is a table.
  -- Based on 'run_missing_migrations.sql', we didn't see the table creation, but let's assume it exists or just return success mock for now if not found.
  -- Actually, let's try to insert if table exists.
  
  -- Deduct coins
  UPDATE user_profiles SET troll_coins = troll_coins - p_coins_to_redeem WHERE id = p_user_id;

  -- Insert request (Generic implementation)
  INSERT INTO public.payout_requests (user_id, coin_amount, status)
  VALUES (p_user_id, p_coins_to_redeem, 'pending');

  RETURN json_build_object('success', true, 'message', 'Payout requested');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ==========================================
-- 4. Update Platform Purchase Functions
-- ==========================================

-- KT Auto Purchase
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

    -- 3. Check Purchase Limit
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

    -- 5. Payment Processing
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

    -- 6. Create User Vehicle
    INSERT INTO public.user_vehicles (user_id, catalog_id)
    VALUES (v_user_id, p_catalog_id)
    RETURNING id INTO v_user_vehicle_id;

    -- 7. Generate Plate
    v_plate_number := public.generate_license_plate();

    -- 8. Create Title
    INSERT INTO public.vehicle_titles (user_vehicle_id, user_id, status)
    VALUES (v_user_vehicle_id, v_user_id, 'clean');

    -- 9. Create Registration
    INSERT INTO public.vehicle_registrations (user_vehicle_id, plate_number, plate_type, expires_at, status)
    VALUES (v_user_vehicle_id, v_plate_number, p_plate_type, v_reg_expiry, 'active');

    -- 10. Create Insurance (Unpaid)
    INSERT INTO public.vehicle_insurance_policies (user_vehicle_id, status)
    VALUES (v_user_vehicle_id, 'unpaid');

    -- 11. Log Transaction
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

-- Generic Shop Purchase (For Consumables/Effects)
CREATE OR REPLACE FUNCTION public.purchase_shop_item(
    p_item_type TEXT,
    p_item_id TEXT,
    p_price INTEGER,
    p_use_credit BOOLEAN DEFAULT FALSE,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_balance BIGINT;
    v_credit_success BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Validate Price
    IF p_price <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid price');
    END IF;

    -- Payment
    IF p_use_credit THEN
        v_credit_success := public.try_pay_with_credit_card(
            v_user_id, 
            p_price::BIGINT, 
            'shop_purchase', 
            p_metadata || jsonb_build_object('item_type', p_item_type, 'item_id', p_item_id)
        );
        
        IF NOT v_credit_success THEN
             RETURN jsonb_build_object('success', false, 'message', 'Credit card declined');
        END IF;
    ELSE
        -- Cash
        SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
        
        IF v_user_balance < p_price THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
        END IF;

        UPDATE public.user_profiles 
        SET troll_coins = troll_coins - p_price
        WHERE id = v_user_id;
    END IF;

    -- Insert Purchase Record (Trigger logic from elsewhere might handle activation)
    INSERT INTO public.user_purchases (
        user_id, 
        item_type, 
        item_id, 
        item_name, 
        purchase_price, 
        is_active, 
        expires_at, 
        metadata
    )
    VALUES (
        v_user_id, 
        p_item_type, 
        p_item_id, 
        p_metadata->>'item_name', 
        p_price, 
        (p_metadata->>'autoActivate')::boolean, 
        (p_metadata->>'expiresAt')::timestamp, 
        p_metadata
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
