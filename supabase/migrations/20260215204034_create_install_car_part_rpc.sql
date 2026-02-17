CREATE OR REPLACE FUNCTION public.install_car_part(
    p_part_id UUID,
    p_user_car_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_part_price INTEGER;
    v_user_balance BIGINT;
    v_part_name TEXT;
    v_part_type part_type; -- Assuming part_type is the ENUM
    v_existing_user_part_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- 1. Verify Authentication
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- 2. Verify Car Ownership and get car details
    IF NOT EXISTS (SELECT 1 FROM public.user_vehicles WHERE id = p_user_car_id AND user_id = v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'User does not own this car');
    END IF;

    -- 3. Get Part Details (price, name, type)
    SELECT price, name, part_type INTO v_part_price, v_part_name, v_part_type
    FROM public.car_parts_catalog
    WHERE id = p_part_id;

    IF v_part_price IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Part not found or invalid part ID');
    END IF;

    -- 4. Check User Balance
    SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id;

    IF v_user_balance < v_part_price THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- 5. Deduct Coins
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_part_price
    WHERE id = v_user_id;

    -- 6. Upsert into user_car_parts:
    --    Check if a part of the same type is already installed on this car.
    --    If yes, update it. If no, insert it.
    SELECT ucp.id INTO v_existing_user_part_id
    FROM public.user_car_parts ucp
    JOIN public.car_parts_catalog cpc ON ucp.part_id = cpc.id
    WHERE ucp.user_car_id = p_user_car_id AND cpc.part_type = v_part_type;

    IF v_existing_user_part_id IS NOT NULL THEN
        -- Update existing part
        UPDATE public.user_car_parts
        SET part_id = p_part_id, installed_at = NOW(), part_type = v_part_type
        WHERE id = v_existing_user_part_id;
    ELSE
        -- Insert new part
        INSERT INTO public.user_car_parts (user_car_id, part_id, part_type)
        VALUES (p_user_car_id, p_part_id, v_part_type);
    END IF;

    -- 7. Log transaction
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (
        v_user_id,
        v_part_price,
        'debit',
        'Installed car part: ' || v_part_name || ' on car ' || p_user_car_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Car part ' || v_part_name || ' installed successfully',
        'part_name', v_part_name,
        'cost', v_part_price
    );

END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';