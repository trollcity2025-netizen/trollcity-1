-- Update refill_gas to exempt level 50+ users and staff
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
    v_buyer_level INTEGER;
    v_ledger_item_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Check Staff Status
    SELECT (role IN ('admin', 'secretary', 'troll_officer', 'lead_troll_officer')) INTO v_is_staff
    FROM public.user_profiles WHERE id = v_user_id;

    -- Check User Level
    SELECT buyer_level INTO v_buyer_level
    FROM public.user_levels
    WHERE user_id = v_user_id;

    -- Calculate Cost
    v_cost := CEIL((p_amount_percent / 5.0) * 300.0);

    -- Apply Exemptions
    IF v_is_staff OR COALESCE(v_buyer_level, 1) >= 50 THEN
        v_cost := 0;
    END IF;

    -- Deduct Coins if cost > 0
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

-- Update consume_gas to grant unlimited gas to staff
CREATE OR REPLACE FUNCTION public.consume_gas(p_amount NUMERIC DEFAULT 5.0)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_gas NUMERIC;
    v_is_staff BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Check Staff Status
    SELECT (role IN ('admin', 'secretary', 'troll_officer', 'lead_troll_officer')) INTO v_is_staff
    FROM public.user_profiles WHERE id = v_user_id;

    IF v_is_staff THEN
        -- Staff gets unlimited gas (ensure it stays at 100)
        UPDATE public.user_profiles
        SET gas_balance = 100.0,
            last_gas_update = now()
        WHERE id = v_user_id
        RETURNING gas_balance INTO v_current_gas;
    ELSE
        -- Normal consumption
        UPDATE public.user_profiles
        SET gas_balance = GREATEST(COALESCE(gas_balance, 100) - p_amount, 0.0),
            last_gas_update = now()
        WHERE id = v_user_id
        RETURNING gas_balance INTO v_current_gas;
    END IF;
    
    RETURN jsonb_build_object('success', true, 'new_balance', v_current_gas);
END;
$$;
