CREATE OR REPLACE FUNCTION public.refill_gas(p_amount_percent INTEGER DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_cost NUMERIC;
    v_spend_res JSONB;
    v_new_gas NUMERIC;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    IF p_amount_percent < 1 OR p_amount_percent > 100 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Percent must be 1-100');
    END IF;

    v_cost := p_amount_percent * 3;

    -- Spend Coins
    v_spend_res := public.troll_bank_spend_coins(
        v_user_id,
        v_cost,
        'paid',
        'gas_station',
        NULL,
        jsonb_build_object('gas_percent', p_amount_percent)
    );

    IF (v_spend_res->>'success')::boolean IS FALSE THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds', 'details', v_spend_res);
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
