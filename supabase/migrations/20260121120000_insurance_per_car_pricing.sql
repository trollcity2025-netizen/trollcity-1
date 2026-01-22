-- Insurance per-car pricing and all-cars coverage
-- When a user buys insurance, it covers ALL their cars and costs 2000 per car owned

DROP FUNCTION IF EXISTS public.buy_car_insurance(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.buy_car_insurance(
  car_garage_id UUID,
  plan_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_user_id UUID;
  v_price BIGINT;
  v_duration_days INTEGER;
  v_car_count INTEGER;
  v_total_price BIGINT;
  v_expires_at TIMESTAMPTZ;
  car_row RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get plan details (default to 2000 coins, 7 days if not found)
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

  -- Count owned cars
  SELECT COUNT(*) INTO v_car_count
  FROM public.user_cars
  WHERE user_id = v_user_id;

  -- If no cars in user_cars, check user_vehicles (fallback for legacy)
  IF v_car_count = 0 THEN
    SELECT COUNT(*) INTO v_car_count
    FROM public.user_vehicles
    WHERE user_id = v_user_id;
  END IF;

  -- Must own at least 1 car
  IF v_car_count = 0 THEN
    RAISE EXCEPTION 'User must own at least one vehicle';
  END IF;

  -- Calculate total price: 2000 per car (v_price should be 2000)
  v_total_price := v_price * v_car_count;

  -- Deduct coins based on number of cars
  PERFORM public.deduct_coins(v_user_id, v_total_price, 'paid');

  -- Calculate expiration
  v_expires_at := NOW() + (v_duration_days || ' days')::INTERVAL;

  -- Apply insurance to ALL owned cars in user_cars
  FOR car_row IN 
    SELECT id FROM public.user_cars WHERE user_id = v_user_id
  LOOP
    UPDATE public.car_insurance_policies
    SET is_active = false,
        expires_at = LEAST(expires_at, NOW())
    WHERE user_id = v_user_id
      AND car_garage_id = car_row.id
      AND is_active = true;

    INSERT INTO public.car_insurance_policies (
      user_id,
      car_garage_id,
      plan_id,
      price_paid_coins,
      duration_days,
      starts_at,
      expires_at,
      is_active
    ) VALUES (
      v_user_id,
      car_row.id,
      plan_id,
      v_price,
      v_duration_days,
      NOW(),
      v_expires_at,
      true
    );
  END LOOP;

  -- Also apply to user_vehicles if it exists (fallback for legacy)
  FOR car_row IN 
    SELECT id FROM public.user_vehicles WHERE user_id = v_user_id
  LOOP
    -- Note: user_vehicles doesn't have insurance table, so we only handle user_cars
    -- This loop is for completeness if legacy schema is needed
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', v_expires_at,
    'cars_covered', v_car_count,
    'total_price', v_total_price,
    'price_per_car', v_price
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_car_insurance(UUID, TEXT) TO authenticated;
