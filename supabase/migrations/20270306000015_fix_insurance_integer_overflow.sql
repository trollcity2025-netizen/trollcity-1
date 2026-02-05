-- Fix Integer Overflow in Insurance and Deduction RPCs

-- 1. Fix renew_vehicle_insurance
-- Problem: v_balance was INTEGER, causing overflow for rich users.
CREATE OR REPLACE FUNCTION renew_vehicle_insurance(p_vehicle_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_cost BIGINT := 2000; -- Changed to BIGINT
    v_balance BIGINT;      -- Changed to BIGINT
    v_current_expiry TIMESTAMPTZ;
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
    INSERT INTO coin_transactions (user_id, amount, type, description)
    VALUES (v_user_id, -v_cost, 'purchase', 'Vehicle Insurance Renewal');

    -- Update or Insert Insurance Policy
    SELECT expires_at INTO v_current_expiry
    FROM vehicle_insurance_policies
    WHERE user_vehicle_id = p_vehicle_id
    AND status = 'active'
    ORDER BY expires_at DESC
    LIMIT 1;

    IF v_current_expiry IS NOT NULL AND v_current_expiry > NOW() THEN
        -- Extend
        UPDATE vehicle_insurance_policies
        SET expires_at = v_current_expiry + INTERVAL '30 days'
        WHERE user_vehicle_id = p_vehicle_id AND status = 'active';
    ELSE
        -- Create new
        INSERT INTO vehicle_insurance_policies (user_vehicle_id, status, expires_at)
        VALUES (p_vehicle_id, 'active', NOW() + INTERVAL '30 days');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Insurance renewed for 30 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Fix pay_vehicle_insurance
-- Problem: v_fee was INTEGER.
CREATE OR REPLACE FUNCTION pay_vehicle_insurance(
    p_user_vehicle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_policy RECORD;
    v_fee BIGINT; -- Changed to BIGINT
    v_user_balance BIGINT;
BEGIN
    v_user_id := auth.uid();

    SELECT * INTO v_policy FROM public.vehicle_insurance_policies WHERE user_vehicle_id = p_user_vehicle_id;
    IF v_policy IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Policy not found');
    END IF;

    -- Verify ownership
    PERFORM 1 FROM public.user_vehicles WHERE id = p_user_vehicle_id AND user_id = v_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not owned by you');
    END IF;

    -- Get fee, cast to BIGINT safely
    SELECT amount::BIGINT INTO v_fee FROM public.tmv_fee_schedule WHERE fee_type = 'insurance_premium';
    v_fee := COALESCE(v_fee, 2000);

    -- Check balance
    SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
    IF v_user_balance < v_fee THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Deduct
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_fee WHERE id = v_user_id;

    -- Update Policy
    UPDATE public.vehicle_insurance_policies
    SET status = 'active',
        expires_at = NOW() + INTERVAL '30 days'
    WHERE id = v_policy.id;

    -- Log
    INSERT INTO public.vehicle_transactions (user_id, user_vehicle_id, type, amount, details)
    VALUES (v_user_id, p_user_vehicle_id, 'insurance_payment', v_fee, jsonb_build_object('period', '30 days'));

    INSERT INTO public.coin_transactions (user_id, amount, type, description)
    VALUES (v_user_id, -v_fee, 'purchase', 'Paid Vehicle Insurance');

    RETURN jsonb_build_object('success', true, 'message', 'Insurance paid');
END;
$$;


-- 3. Fix deduct_user_coins (helper used by some logic)
-- Problem: v_current_balance was INTEGER
CREATE OR REPLACE FUNCTION deduct_user_coins(
  p_user_id UUID,
  p_amount BIGINT,
  p_reason TEXT,
  p_appeal_id UUID DEFAULT NULL,
  p_verdict TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_current_balance BIGINT; -- Changed to BIGINT
  v_deducted BIGINT;        -- Changed to BIGINT
BEGIN
  SELECT troll_coins INTO v_current_balance
  FROM user_profiles
  WHERE id = p_user_id;

  v_deducted := LEAST(v_current_balance, p_amount);

  UPDATE user_profiles
  SET troll_coins = GREATEST(troll_coins - p_amount, 0)
  WHERE id = p_user_id;

  INSERT INTO punishment_transactions (user_id, coins_deducted, reason, appeal_id, verdict)
  VALUES (p_user_id, v_deducted, p_reason, p_appeal_id, p_verdict);

  RETURN json_build_object(
    'success', true,
    'deducted', v_deducted,
    'remaining', GREATEST(v_current_balance - p_amount, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fix buy_car_insurance
-- Problem: Ensure v_price and calculations are BIGINT
CREATE OR REPLACE FUNCTION public.buy_car_insurance(
  car_garage_id UUID,
  plan_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_user_id UUID;
  v_price BIGINT;
  v_duration_days INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  BEGIN
    SELECT price_paid_coins, duration_days
    INTO v_price, v_duration_days
    FROM public.insurance_plans
    WHERE id = plan_id;
  EXCEPTION WHEN undefined_table THEN
    v_price := 2000;
    v_duration_days := 7;
  END;

  IF v_price IS NULL OR v_duration_days IS NULL THEN
    v_price := 2000;
    v_duration_days := 7;
  END IF;

  -- Use deduct_coins (JS calls RPC wrapper usually, but here we might call direct deduction if available, 
  -- but since this is RPC calling another RPC or just doing work, let's be safe and use direct update or safe spender)
  -- The original called public.deduct_coins which might be a wrapper.
  -- Let's check if deduct_coins exists, otherwise do direct.
  -- Safe approach: Direct update with check, logging.
  
  IF (SELECT troll_coins FROM user_profiles WHERE id = v_user_id) < v_price THEN
     RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;
  
  UPDATE user_profiles SET troll_coins = troll_coins - v_price WHERE id = v_user_id;
  
  -- Log it
  INSERT INTO coin_transactions (user_id, amount, type, description)
  VALUES (v_user_id, -v_price, 'purchase', 'Bought Car Insurance');

  RETURN public._apply_car_insurance(
    v_user_id,
    car_garage_id,
    plan_id,
    v_price,
    v_duration_days
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', SQLERRM
  );
END;
$$;


-- 5. Fix buy_property_insurance
-- Problem: Ensure BIGINT
CREATE OR REPLACE FUNCTION public.buy_property_insurance(
  house_id UUID,
  plan_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_user_id UUID;
  v_price BIGINT;
  v_duration_days INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  BEGIN
    SELECT price_paid_coins, duration_days
    INTO v_price, v_duration_days
    FROM public.insurance_plans
    WHERE id = plan_id;
  EXCEPTION WHEN undefined_table THEN
    v_price := 2000;
    v_duration_days := 7;
  END;

  IF v_price IS NULL OR v_duration_days IS NULL THEN
    v_price := 2000;
    v_duration_days := 7;
  END IF;

  -- Check and Deduct
  IF (SELECT troll_coins FROM user_profiles WHERE id = v_user_id) < v_price THEN
     RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;
  
  UPDATE user_profiles SET troll_coins = troll_coins - v_price WHERE id = v_user_id;

  -- Log
  INSERT INTO coin_transactions (user_id, amount, type, description)
  VALUES (v_user_id, -v_price, 'purchase', 'Bought Property Insurance');

  RETURN public._apply_property_insurance(
    v_user_id,
    house_id,
    plan_id,
    v_price,
    v_duration_days
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', SQLERRM
  );
END;
$$;
