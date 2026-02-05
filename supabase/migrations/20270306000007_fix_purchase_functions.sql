-- Fix purchase_house and purchase_vehicle functions to handle try_pay_coins correctly
-- try_pay_coins returns BOOLEAN, not a record with success/message columns

CREATE OR REPLACE FUNCTION public.purchase_house(p_house_catalog_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_house RECORD;
    v_price BIGINT;
    v_success BOOL;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    SELECT * INTO v_house FROM public.houses_catalog WHERE id = p_house_catalog_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'House not found');
    END IF;

    v_price := v_house.base_price;

    -- Deduct coins
    v_success := public.try_pay_coins(v_user_id, v_price, 'house_purchase', jsonb_build_object('house_id', p_house_catalog_id));
    
    IF NOT v_success THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Insert into user_houses
    INSERT INTO public.user_houses (user_id, house_catalog_id, purchase_price, next_due_at, status, condition, influence_active)
    VALUES (v_user_id, p_house_catalog_id, v_price, NOW() + INTERVAL '1 day', 'active', 100, true);

    RETURN jsonb_build_object('success', true, 'message', 'House purchased successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.purchase_vehicle(p_car_catalog_id UUID, p_plate_type TEXT DEFAULT 'temp')
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_car RECORD;
    v_price BIGINT;
    v_fees BIGINT;
    v_total_cost BIGINT;
    v_success BOOL;
    v_plate_number TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    SELECT * INTO v_car FROM public.cars_catalog WHERE id = p_car_catalog_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not found');
    END IF;

    v_price := v_car.base_price;
    -- Base registration fee from catalog, fallback to 100
    v_fees := COALESCE(v_car.registration_fee, 100);
    
    -- Add plate fee logic
    IF p_plate_type = 'hard' THEN
        v_fees := v_fees + 2000;
    ELSE
        v_fees := v_fees + 200;
    END IF;

    v_total_cost := v_price + v_fees;

    -- Deduct coins
    v_success := public.try_pay_coins(v_user_id, v_total_cost, 'car_purchase', jsonb_build_object('car_id', p_car_catalog_id));
    
    IF NOT v_success THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Generate Plate (Random 3 letters + 3 numbers for style)
    -- Or just random string. Let's do random string for now.
    v_plate_number := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 7));

    -- Insert into user_cars
    INSERT INTO public.user_cars (user_id, car_catalog_id, purchase_price, plate_number, plate_status, condition, status)
    VALUES (v_user_id, p_car_catalog_id, v_price, v_plate_number, p_plate_type, 100, 'active');

    RETURN jsonb_build_object('success', true, 'message', 'Vehicle purchased successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
