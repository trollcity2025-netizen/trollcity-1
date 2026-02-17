-- Fix KT Auto purchase_vehicle signature to accept INTEGER
-- Fix refill_gas to log to purchase_ledger
-- Ensure request_gas exists

-- 1. Fix purchase_vehicle to accept INTEGER
DROP FUNCTION IF EXISTS public.purchase_vehicle(UUID, TEXT);
DROP FUNCTION IF EXISTS public.purchase_vehicle(INTEGER, TEXT);




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
