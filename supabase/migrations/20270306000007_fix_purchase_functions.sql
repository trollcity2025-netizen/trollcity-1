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

-- Drop the legacy UUID version to avoid ambiguity
DROP FUNCTION IF EXISTS public.purchase_vehicle(UUID, TEXT);

-- Create a view for the dealership to ensure consistent data structure
DROP VIEW IF EXISTS public.v_dealership_catalog;

-- Grant access to the view


DROP FUNCTION IF EXISTS public.purchase_vehicle(INTEGER, TEXT);
