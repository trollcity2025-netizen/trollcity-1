-- Update purchase_vehicle to log to purchase_ledger
-- Fixes signature to use UUID for catalog_id

-- Drop the old function with INTEGER signature if it exists
DROP FUNCTION IF EXISTS public.purchase_vehicle(INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.purchase_vehicle(p_car_catalog_id UUID, p_plate_type TEXT DEFAULT 'temp')
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
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Validate User
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- 2. Get Car Details
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

    -- 5. Check Balance & Deduct
    SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
    
    IF v_user_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
    END IF;

    UPDATE public.user_profiles 
    SET troll_coins = troll_coins - v_total_cost 
    WHERE id = v_user_id;

    -- 6. Insert Vehicle
    INSERT INTO public.user_cars (
        user_id, car_catalog_id, purchase_price, condition, status, 
        insurance_expires_at, registration_expires_at, plate_status, last_fees_paid_at,
        model_url, current_value
    ) VALUES (
        v_user_id, p_car_catalog_id, v_car.price, 100, 'insured', 
        NOW() + INTERVAL '7 days', v_reg_expiry, 'valid', NOW(),
        v_car.model_url, v_car.price
    );

    -- 7. Log to Purchase Ledger
    -- Try to find in purchasable_items by display_name
    SELECT id INTO v_ledger_item_id FROM public.purchasable_items WHERE display_name = v_car.name LIMIT 1;
    
    IF v_ledger_item_id IS NOT NULL THEN
        INSERT INTO public.purchase_ledger (
            user_id, item_id, coin_amount, payment_method, source_context, created_at
        ) VALUES (
            v_user_id, v_ledger_item_id, v_total_cost, 'coins', 'Dealership', now()
        );
    ELSE
        -- Fallback: Insert dynamic item
        INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_coin_pack, frontend_source)
        VALUES ('auto-' || v_car.slug, v_car.name, 'vehicle', v_car.price, false, 'Dealership')
        ON CONFLICT (item_key) DO UPDATE SET coin_price = EXCLUDED.coin_price
        RETURNING id INTO v_ledger_item_id;
        
        INSERT INTO public.purchase_ledger (
            user_id, item_id, coin_amount, payment_method, source_context, created_at
        ) VALUES (
            v_user_id, v_ledger_item_id, v_total_cost, 'coins', 'Dealership', now()
        );
    END IF;

    -- 8. Log Transaction (Legacy)
    INSERT INTO public.vehicle_transactions (user_id, vehicle_id, type, amount, description)
    VALUES (v_user_id, p_car_catalog_id, 'purchase', -v_total_cost, 'Purchase ' || v_car.name);

    RETURN jsonb_build_object('success', true, 'message', 'Vehicle purchased');
END;
$$;
