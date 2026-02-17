
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


