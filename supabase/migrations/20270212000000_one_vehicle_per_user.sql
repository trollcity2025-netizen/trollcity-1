-- Migration: One Vehicle Per User Restriction
-- This ensures users can only own one vehicle at a time

-- Create function to check if user has an active vehicle
CREATE OR REPLACE FUNCTION public.user_has_active_vehicle(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_vehicle BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.user_cars
        WHERE user_id = COALESCE(p_user_id, auth.uid())
        AND is_active = true
    ) INTO v_has_vehicle;
    
    RETURN v_has_vehicle;
END;
$$;

-- Create function to get user's active vehicle ID
CREATE OR REPLACE FUNCTION public.get_active_vehicle_id(p_user_id UUID DEFAULT auth.uid())
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_vehicle_id UUID;
BEGIN
    SELECT id INTO v_vehicle_id
    FROM public.user_cars
    WHERE user_id = COALESCE(p_user_id, auth.uid())
    AND is_active = true
    LIMIT 1;
    
    RETURN v_vehicle_id;
END;
$$;

-- Update purchase_car_v2 to enforce one vehicle per user (with exception for free cars)
CREATE OR REPLACE FUNCTION public.purchase_car_v2(
    p_car_id TEXT,
    p_model_url TEXT,
    p_customization JSONB DEFAULT '{}'::jsonb,
    p_is_free BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_new_id UUID;
    v_has_existing_vehicle BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if user already has an active vehicle
    SELECT public.user_has_active_vehicle(v_user_id) INTO v_has_existing_vehicle;

    -- If user has a vehicle and this is NOT a free car, reject the purchase
    IF v_has_existing_vehicle AND NOT p_is_free THEN
        RAISE EXCEPTION 'You already own a vehicle. Please sell your current vehicle before purchasing a new one.';
    END IF;

    -- Insert the new car
    INSERT INTO public.user_cars (user_id, car_id, model_url, customization_json, is_active)
    VALUES (v_user_id, p_car_id, p_model_url, p_customization, true)
    RETURNING id INTO v_new_id;

    -- If this is the user's first car or replacing an existing one, make it active
    PERFORM public.set_active_car(v_new_id);

    RETURN v_new_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.user_has_active_vehicle(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_vehicle_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_car_v2(TEXT, TEXT, JSONB, BOOLEAN) TO authenticated;
