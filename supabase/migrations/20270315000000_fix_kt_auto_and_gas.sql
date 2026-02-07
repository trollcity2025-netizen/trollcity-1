-- Fix KT Auto purchase_vehicle signature to accept INTEGER
-- Fix refill_gas to log to purchase_ledger
-- Ensure request_gas exists

-- 1. Fix purchase_vehicle to accept INTEGER
DROP FUNCTION IF EXISTS public.purchase_vehicle(UUID, TEXT);
DROP FUNCTION IF EXISTS public.purchase_vehicle(INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.purchase_vehicle(p_car_catalog_id INTEGER, p_plate_type TEXT DEFAULT 'temp')
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
    v_ledger_item_id UUID;
    v_reg_expiry TIMESTAMPTZ;
    v_user_vehicle_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Validate User
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- 2. Get Car Details
    -- Using id::integer just in case, though parameter is integer
    SELECT * INTO v_car FROM public.vehicles_catalog WHERE id = p_car_catalog_id;
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

    -- 5. Spend Coins (Centralized Bank)
    -- This handles balance check and locking
    PERFORM public.troll_bank_spend_coins(
        v_user_id,
        v_total_cost,
        'paid',
        'vehicle_purchase',
        p_car_catalog_id::text,
        jsonb_build_object('car_name', v_car.name, 'plate_type', p_plate_type)
    );

    -- 6. Insert User Vehicle
    INSERT INTO public.user_cars (
        user_id, car_id, model_url, purchase_price, 
        condition, status, insurance_rate_bps, exposure_level,
        plate_status, purchased_at, is_active, registration_expires_at
    ) VALUES (
        v_user_id, 
        p_car_catalog_id, -- Storing catalog ID as car_id (integer)
        v_car.model_url, 
        v_car.price,
        100, -- Condition
        'active',
        10, -- Default insurance rate (will be updated by policy)
        4, -- Default exposure
        CASE WHEN p_plate_type = 'hard' THEN 'valid' ELSE 'temp_valid' END,
        now(),
        false, -- Not active by default? Or true? Let's say false to not override current active.
        v_reg_expiry
    ) RETURNING id INTO v_user_vehicle_id;

    -- 7. Log to Purchase Ledger (Inventory)
    -- Find or Create Item
    SELECT id INTO v_ledger_item_id FROM public.purchasable_items WHERE display_name = v_car.name LIMIT 1;
    
    IF v_ledger_item_id IS NULL THEN
        INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_coin_pack, frontend_source)
        VALUES ('auto-' || v_car.slug, v_car.name, 'vehicle', v_car.price, false, 'Dealership')
        ON CONFLICT (item_key) DO UPDATE SET coin_price = EXCLUDED.coin_price
        RETURNING id INTO v_ledger_item_id;
    END IF;

    INSERT INTO public.purchase_ledger (
        user_id, item_id, coin_amount, payment_method, source_context, created_at
    ) VALUES (
        v_user_id, v_ledger_item_id, v_total_cost, 'coins', 'Dealership', now()
    );

    -- 8. Log Transaction (Legacy)
    INSERT INTO public.vehicle_transactions (user_id, vehicle_id, type, amount, description)
    VALUES (v_user_id, p_car_catalog_id, 'purchase', -v_total_cost, 'Purchase ' || v_car.name);

    RETURN jsonb_build_object('success', true, 'message', 'Vehicle purchased');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


-- 2. Refill Gas with Purchase Ledger Logging
DROP FUNCTION IF EXISTS public.refill_gas(INTEGER);
DROP FUNCTION IF EXISTS public.refill_gas(NUMERIC);

CREATE OR REPLACE FUNCTION public.refill_gas(p_amount_percent NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_gas NUMERIC;
    v_cost BIGINT;
    v_new_gas NUMERIC;
    v_is_staff BOOLEAN;
    v_ledger_item_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Check Staff Status (Staff don't pay)
    SELECT (role IN ('admin', 'secretary', 'troll_officer', 'lead_troll_officer')) INTO v_is_staff
    FROM public.user_profiles WHERE id = v_user_id;

    -- Calculate Cost: 300 coins per 5%
    -- Ensure we handle float inputs gracefully
    v_cost := CEIL((p_amount_percent / 5.0) * 300.0);

    IF v_is_staff THEN
        v_cost := 0;
    END IF;

    -- Deduct Coins
    IF v_cost > 0 THEN
        PERFORM public.troll_bank_spend_coins(
            v_user_id,
            v_cost,
            'paid',
            'gas_refill',
            NULL,
            jsonb_build_object('amount', p_amount_percent)
        );

        -- Log to Purchase Ledger
        -- Find or Create Gas Item
        SELECT id INTO v_ledger_item_id FROM public.purchasable_items WHERE item_key = 'gas_refill' LIMIT 1;
        
        IF v_ledger_item_id IS NULL THEN
            INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_coin_pack, frontend_source)
            VALUES ('gas_refill', 'Gas Refill', 'consumable', 300, false, 'GasStation')
            RETURNING id INTO v_ledger_item_id;
        END IF;

        INSERT INTO public.purchase_ledger (
            user_id, item_id, coin_amount, payment_method, source_context, created_at
        ) VALUES (
            v_user_id, v_ledger_item_id, v_cost, 'coins', 'GasStation', now()
        );
    END IF;

    -- Update Gas
    UPDATE public.user_profiles
    SET gas_balance = LEAST(COALESCE(gas_balance, 0) + p_amount_percent, 100.0),
        last_gas_update = now()
    WHERE id = v_user_id
    RETURNING gas_balance INTO v_new_gas;

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_gas, 'cost', v_cost);
END;
$$;


-- 3. Consume Gas RPC
CREATE OR REPLACE FUNCTION public.consume_gas(p_amount NUMERIC DEFAULT 5.0)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_gas NUMERIC;
BEGIN
    v_user_id := auth.uid();
    
    UPDATE public.user_profiles
    SET gas_balance = GREATEST(COALESCE(gas_balance, 100) - p_amount, 0.0),
        last_gas_update = now()
    WHERE id = v_user_id
    RETURNING gas_balance INTO v_current_gas;
    
    RETURN jsonb_build_object('success', true, 'new_balance', v_current_gas);
END;
$$;


-- 4. Request Gas RPC
CREATE OR REPLACE FUNCTION public.request_gas(p_target_user_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_requester_username TEXT;
BEGIN
    v_user_id := auth.uid();
    
    INSERT INTO public.gas_requests (requester_id, target_user_id, amount)
    VALUES (v_user_id, p_target_user_id, p_amount);
    
    -- Get requester username for notification
    SELECT username INTO v_requester_username FROM public.user_profiles WHERE id = v_user_id;

    -- Create notification for target user
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
        p_target_user_id,
        'gas_request',
        'Gas Request',
        v_requester_username || ' requested ' || p_amount || '% gas from you.',
        jsonb_build_object('requester_id', v_user_id, 'amount', p_amount)
    );
    
    RETURN jsonb_build_object('success', true);
END;
$$;
