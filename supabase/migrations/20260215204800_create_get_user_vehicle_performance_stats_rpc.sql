CREATE OR REPLACE FUNCTION public.get_user_vehicle_performance_stats(
    p_user_vehicle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_base_speed INTEGER;
    v_base_armor INTEGER;
    v_part_speed_bonus INTEGER := 0;
    v_part_armor_bonus INTEGER := 0;
    v_part_weight_modifier INTEGER := 0;
    v_part_handling_modifier INTEGER := 0;
    v_part_fuel_efficiency_modifier NUMERIC := 0.0;
    v_catalog_id INTEGER;
BEGIN
    -- Get the catalog ID for the user's vehicle
    SELECT catalog_id INTO v_catalog_id
    FROM public.user_vehicles
    WHERE id = p_user_vehicle_id;

    IF v_catalog_id IS NULL THEN
        RETURN jsonb_build_object('error', 'User vehicle not found');
    END IF;

    -- Get base stats from vehicles_catalog
    SELECT speed, armor INTO v_base_speed, v_base_armor
    FROM public.vehicles_catalog
    WHERE id = v_catalog_id;

    -- Aggregate bonuses from installed parts
    SELECT
        COALESCE(SUM(cpc.speed_bonus), 0),
        COALESCE(SUM(cpc.armor_bonus), 0),
        COALESCE(SUM(cpc.weight_modifier), 0),
        COALESCE(SUM(cpc.handling_modifier), 0),
        COALESCE(SUM(cpc.fuel_efficiency_modifier), 0.0)
    INTO
        v_part_speed_bonus,
        v_part_armor_bonus,
        v_part_weight_modifier,
        v_part_handling_modifier,
        v_part_fuel_efficiency_modifier
    FROM public.user_car_parts ucp
    JOIN public.car_parts_catalog cpc ON ucp.part_id = cpc.id
    WHERE ucp.user_car_id = p_user_vehicle_id;

    -- Return combined stats
    RETURN jsonb_build_object(
        'total_speed', v_base_speed + v_part_speed_bonus,
        'total_armor', v_base_armor + v_part_armor_bonus,
        'total_weight_modifier', v_part_weight_modifier,
        'total_handling_modifier', v_part_handling_modifier,
        'total_fuel_efficiency_modifier', v_part_fuel_efficiency_modifier
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_vehicle_performance_stats(UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';