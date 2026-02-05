
-- 1. Update License Plate RPC
CREATE OR REPLACE FUNCTION public.update_vehicle_plate(
    p_user_vehicle_id UUID,
    p_new_plate TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_registration RECORD;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Validate input
    IF length(p_new_plate) < 3 OR length(p_new_plate) > 8 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Plate must be 3-8 characters');
    END IF;

    IF NOT p_new_plate ~* '^[A-Z0-9]+$' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Plate must be alphanumeric');
    END IF;

    -- Check ownership
    IF NOT EXISTS (
        SELECT 1 FROM public.user_vehicles 
        WHERE id = p_user_vehicle_id AND user_id = v_user_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not found or not owned by you');
    END IF;

    -- Check availability
    IF EXISTS (
        SELECT 1 FROM public.vehicle_registrations 
        WHERE plate_number = UPPER(p_new_plate)
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Plate number already taken');
    END IF;

    -- Update registration
    UPDATE public.vehicle_registrations
    SET plate_number = UPPER(p_new_plate)
    WHERE user_vehicle_id = p_user_vehicle_id;

    RETURN jsonb_build_object('success', true, 'message', 'License plate updated to ' || UPPER(p_new_plate));
END;
$$;

-- 2. Update Sell Vehicle RPC to account for mods value
CREATE OR REPLACE FUNCTION public.sell_vehicle(p_user_vehicle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_vehicle RECORD;
    v_catalog RECORD;
    v_sell_price INTEGER;
    v_base_mod_cost INTEGER;
    v_mod_total_cost INTEGER := 0;
    v_mod_key TEXT;
    v_mod_level INTEGER;
BEGIN
    v_user_id := auth.uid();
    
    -- Check authentication
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Get vehicle and verify ownership
    SELECT * INTO v_vehicle FROM public.user_vehicles 
    WHERE id = p_user_vehicle_id AND user_id = v_user_id;
    
    IF v_vehicle IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not found or not owned by you');
    END IF;

    -- Get catalog details for pricing
    SELECT * INTO v_catalog FROM public.vehicles_catalog WHERE id = v_vehicle.catalog_id;
    
    -- Calculate Base Mod Cost Unit (Logic from upgrade_vehicle)
    -- Formula: GREATEST(FLOOR(v_catalog.price * 0.1), 1000)
    v_base_mod_cost := GREATEST(FLOOR(v_catalog.price * 0.1), 1000);

    -- Calculate Value of Installed Mods
    -- Level 1 cost: 1 unit
    -- Level 2 cost: 2 units (Total 3 units for Lvl 2)
    -- Level 3 cost: 3 units (Total 6 units for Lvl 3)
    IF v_vehicle.mods IS NOT NULL THEN
        FOR v_mod_key, v_mod_level IN SELECT * FROM jsonb_each_text(v_vehicle.mods)
        LOOP
             -- Sum of integers formula: n * (n + 1) / 2
             v_mod_total_cost := v_mod_total_cost + (v_mod_level::INTEGER * (v_mod_level::INTEGER + 1) / 2) * v_base_mod_cost;
        END LOOP;
    END IF;

    -- Calculate final sell price (50% of car value + 50% of mod value)
    v_sell_price := FLOOR(v_catalog.price * 0.5) + FLOOR(v_mod_total_cost * 0.5);

    -- 1. Delete vehicle (Cascades to titles, registrations, insurance due to FK constraints)
    DELETE FROM public.user_vehicles WHERE id = p_user_vehicle_id;

    -- 2. Add Coins
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins + v_sell_price 
    WHERE id = v_user_id;

    -- 3. Log Transaction
    INSERT INTO public.vehicle_transactions (user_id, type, amount, details)
    VALUES (
        v_user_id, 
        'sale', 
        v_sell_price, 
        jsonb_build_object(
            'vehicle_id', p_user_vehicle_id,
            'catalog_id', v_vehicle.catalog_id,
            'car_name', v_catalog.name,
            'reason', 'User sold to dealer',
            'base_refund', FLOOR(v_catalog.price * 0.5),
            'mods_refund', FLOOR(v_mod_total_cost * 0.5)
        )
    );

    -- 4. Coin Transaction Log
    INSERT INTO public.coin_transactions (user_id, amount, type, description)
    VALUES (
        v_user_id, 
        v_sell_price, 
        'sale', 
        'Sold ' || v_catalog.name || ' to KTAuto (incl. mods)'
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Vehicle sold for ' || v_sell_price || ' coins',
        'amount', v_sell_price
    );
END;
$$;
