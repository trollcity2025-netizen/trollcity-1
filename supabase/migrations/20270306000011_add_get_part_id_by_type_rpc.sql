CREATE OR REPLACE FUNCTION public.get_part_id_by_type(
    p_part_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_part_id UUID;
BEGIN
    SELECT id INTO v_part_id
    FROM public.car_parts_catalog
    WHERE part_type = p_part_type::part_type
    LIMIT 1;

    RETURN v_part_id;
END;
$$;