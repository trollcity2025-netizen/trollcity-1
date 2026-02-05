
-- Fix for "duplicate key value violates unique constraint" in insurance renewal
-- The previous RPC used ON CONFLICT with a WHERE clause, but the unique constraint is unconditional.
-- Also fixes potential column name mismatch (vehicle_id vs user_vehicle_id).

CREATE OR REPLACE FUNCTION renew_vehicle_insurance(p_vehicle_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_cost INTEGER := 2000; -- Fixed cost as per UI
    v_balance INTEGER;
    v_current_expiry TIMESTAMPTZ;
    v_new_expiry TIMESTAMPTZ;
BEGIN
    -- Get user ID from vehicle
    SELECT user_id INTO v_user_id
    FROM user_vehicles
    WHERE id = p_vehicle_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not found');
    END IF;

    -- Check ownership
    IF v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not your vehicle');
    END IF;

    -- Check balance
    SELECT troll_coins INTO v_balance
    FROM user_profiles
    WHERE id = v_user_id;

    IF v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Deduct coins
    UPDATE user_profiles
    SET troll_coins = troll_coins - v_cost
    WHERE id = v_user_id;

    -- Record transaction
    INSERT INTO coin_transactions (from_user_id, to_user_id, amount, reason)
    VALUES (v_user_id, NULL, v_cost, 'Vehicle Insurance Renewal');

    -- Calculate Expiry
    SELECT expires_at INTO v_current_expiry
    FROM vehicle_insurance_policies
    WHERE user_vehicle_id = p_vehicle_id
    ORDER BY expires_at DESC
    LIMIT 1;

    IF v_current_expiry IS NOT NULL AND v_current_expiry > NOW() THEN
        v_new_expiry := v_current_expiry + INTERVAL '30 days';
    ELSE
        v_new_expiry := NOW() + INTERVAL '30 days';
    END IF;

    -- Upsert Policy
    -- Uses user_vehicle_id to match the unique constraint key
    INSERT INTO vehicle_insurance_policies (user_vehicle_id, provider, policy_number, expires_at, status)
    VALUES (
        p_vehicle_id,
        'Troll City Insurance',
        'POL-' || upper(substring(md5(random()::text), 1, 8)),
        v_new_expiry,
        'active'
    )
    ON CONFLICT (user_vehicle_id) 
    DO UPDATE SET 
        expires_at = EXCLUDED.expires_at,
        status = 'active';

    RETURN jsonb_build_object('success', true, 'new_expiry', v_new_expiry);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
