-- Migration: Car Valuation Logic and Triggers

-- 1. Function to calculate and update the current value of a specific user car
-- Value = Base Catalog Price + Sum of User's Upgrades for that Model
CREATE OR REPLACE FUNCTION public.update_car_value(p_user_car_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_model_url TEXT;
    v_catalog_id UUID;
    v_base_price INTEGER := 0;
    v_upgrade_total INTEGER := 0;
    v_catalog_rec RECORD;
BEGIN
    -- Get car details
    SELECT user_id, model_url INTO v_user_id, v_model_url
    FROM public.user_cars
    WHERE id = p_user_car_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Find Catalog Entry via model_url (most reliable link)
    SELECT * INTO v_catalog_rec
    FROM public.vehicles_catalog
    WHERE model_url = v_model_url
    LIMIT 1;

    IF FOUND THEN
        v_base_price := v_catalog_rec.price;
        v_catalog_id := v_catalog_rec.id;
        
        -- If we found the catalog ID, we can sum the upgrades
        -- Note: vehicle_upgrades links to the Model ID (catalog ID), not the specific instance
        -- We try to match by string casting since vehicle_upgrades.vehicle_id might be stored variously
        -- But based on code, it stores the ID from the catalog.
        
        -- We handle the case where vehicle_upgrades.vehicle_id might be the UUID of the catalog item
        -- OR the string ID if legacy. The catalog has UUID id.
        
        SELECT COALESCE(SUM(cost), 0)
        INTO v_upgrade_total
        FROM public.vehicle_upgrades
        WHERE user_id = v_user_id
        AND (
            vehicle_id = v_catalog_id::text 
            OR 
            vehicle_id = v_catalog_rec.slug
        );
        
    ELSE
        -- Fallback if model_url doesn't match (legacy cars?)
        -- Try to trust the 'current_value' if it was set, or default to 0
        v_base_price := 0;
    END IF;

    -- Update the user_cars table
    UPDATE public.user_cars
    SET current_value = v_base_price + v_upgrade_total
    WHERE id = p_user_car_id;

END;
$$;

-- 2. Trigger Function for Upgrade Changes
CREATE OR REPLACE FUNCTION public.trigger_update_car_value_on_upgrade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_catalog_id TEXT;
    v_model_url TEXT;
    v_car_rec RECORD;
BEGIN
    -- Determine the vehicle_id (Model ID) involved
    IF (TG_OP = 'DELETE') THEN
        v_catalog_id := OLD.vehicle_id;
    ELSE
        v_catalog_id := NEW.vehicle_id;
    END IF;

    -- Find all user_cars that match this model for this user
    -- We need to map the v_catalog_id (which is from vehicle_upgrades) to user_cars
    -- v_catalog_id corresponds to vehicles_catalog.id or slug.
    
    -- We'll find the catalog entry first to get the model_url
    SELECT model_url INTO v_model_url
    FROM public.vehicles_catalog
    WHERE id::text = v_catalog_id OR slug = v_catalog_id;

    IF v_model_url IS NOT NULL THEN
        -- Update all instances of this car model for the user
        FOR v_car_rec IN 
            SELECT id FROM public.user_cars 
            WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) 
            AND model_url = v_model_url
        LOOP
            PERFORM public.update_car_value(v_car_rec.id);
        END LOOP;
    END IF;

    RETURN NULL;
END;
$$;

-- 3. Trigger on vehicle_upgrades
DROP TRIGGER IF EXISTS on_vehicle_upgrade_change ON public.vehicle_upgrades;
CREATE TRIGGER on_vehicle_upgrade_change
AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_upgrades
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_car_value_on_upgrade();

-- 4. Trigger Function for New Car Purchase
CREATE OR REPLACE FUNCTION public.trigger_update_car_value_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.update_car_value(NEW.id);
    RETURN NEW;
END;
$$;

-- 5. Trigger on user_cars
DROP TRIGGER IF EXISTS on_user_car_insert ON public.user_cars;
CREATE TRIGGER on_user_car_insert
AFTER INSERT ON public.user_cars
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_car_value_on_insert();

-- 6. Initial Population
-- Run update for all existing cars
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.user_cars LOOP
        PERFORM public.update_car_value(r.id);
    END LOOP;
END $$;
