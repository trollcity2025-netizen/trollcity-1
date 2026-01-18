DO $$ BEGIN
  ALTER TABLE public.user_profiles ADD COLUMN owned_vehicle_ids JSONB DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.add_owned_vehicle_to_profile(
  p_vehicle_id INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_user_id UUID;
  v_owned_ids JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.user_profiles
  SET owned_vehicle_ids = (
    SELECT jsonb_agg(DISTINCT elem ORDER BY elem)
    FROM jsonb_array_elements(
      coalesce(owned_vehicle_ids, '[]'::jsonb) || to_jsonb(p_vehicle_id)
    ) AS e(elem)
  )
  WHERE id = v_user_id
  RETURNING owned_vehicle_ids INTO v_owned_ids;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for id %', v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'owned_vehicle_ids', v_owned_ids
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_owned_vehicle_to_profile(INTEGER) TO authenticated;
