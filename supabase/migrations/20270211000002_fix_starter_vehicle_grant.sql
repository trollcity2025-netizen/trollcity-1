-- Migration: Fix grant_starter_vehicle function
-- This function is called during signup but was missing from migration files

-- Create/replace the grant_starter_vehicle function
CREATE OR REPLACE FUNCTION public.grant_starter_vehicle(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_starter_car RECORD;
    v_new_car_id UUID;
BEGIN
    -- Find the starter car from vehicles_catalog
    -- Using case-insensitive search for 'Starter' tier
    SELECT * INTO v_starter_car
    FROM public.vehicles_catalog
    WHERE LOWER(tier) = LOWER('Starter')
    ORDER BY price ASC
    LIMIT 1;

    -- If no starter car found with 'Starter' tier, try to find the cheapest car
    IF NOT FOUND THEN
        SELECT * INTO v_starter_car
        FROM public.vehicles_catalog
        ORDER BY price ASC
        LIMIT 1;
    END IF;

    -- If still no car found, raise an error
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Starter vehicle not found in vehicles_catalog';
    END IF;

    -- Insert the starter car for the user
    INSERT INTO public.user_cars (
        user_id,
        car_id,
        model_url,
        customization_json,
        is_active
    ) VALUES (
        p_user_id,
        v_starter_car.slug,
        v_starter_car.model_url,
        jsonb_build_object(
            'color', v_starter_car.color_from,
            'car_model_id', v_starter_car.id,
            'source', 'starter_grant'
        ),
        false
    )
    RETURNING id INTO v_new_car_id;

    -- If this is the user's first car, make it active
    IF NOT EXISTS (SELECT 1 FROM public.user_cars WHERE user_id = p_user_id AND is_active = true) THEN
        UPDATE public.user_cars SET is_active = true WHERE id = v_new_car_id;
    END IF;

    RETURN v_new_car_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.grant_starter_vehicle(UUID) TO authenticated;

-- Also update handle_new_user_credit to call grant_starter_vehicle
-- Check if the function exists and update it
CREATE OR REPLACE FUNCTION public.handle_new_user_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    -- Create user credit record
    INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
    VALUES (
        NEW.id,
        400, -- Default starting score
        'Building', -- Default tier
        0, -- No trend yet
        NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Grant starter vehicle (this will not fail if it can't find one, it will just log a warning)
    BEGIN
        PERFORM public.grant_starter_vehicle(NEW.id);
    EXCEPTION WHEN OTHERS THEN
        -- Log the error but don't fail user creation
        RAISE WARNING 'Could not grant starter vehicle for user %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail auth user creation
    RAISE WARNING 'Error in handle_new_user_credit for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure the trigger exists for handle_new_user_credit
DROP TRIGGER IF EXISTS on_auth_user_created_credit ON auth.users;
CREATE TRIGGER on_auth_user_created_credit
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_credit();
