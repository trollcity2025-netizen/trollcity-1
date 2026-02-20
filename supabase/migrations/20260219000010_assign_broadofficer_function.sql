
CREATE OR REPLACE FUNCTION public.assign_broadofficer(p_officer_id uuid, p_broadcaster_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the caller is the broadcaster
  IF auth.uid() != p_broadcaster_id THEN
    RAISE EXCEPTION 'Only the broadcaster can assign officers.';
  END IF;

  -- Insert the new broadofficer assignment
  INSERT INTO public.broadcast_officers (officer_id, broadcaster_id)
  VALUES (p_officer_id, p_broadcaster_id)
  ON CONFLICT (officer_id, broadcaster_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.unassign_broadofficer(p_officer_id uuid, p_broadcaster_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the caller is the broadcaster
  IF auth.uid() != p_broadcaster_id THEN
    RAISE EXCEPTION 'Only the broadcaster can unassign officers.';
  END IF;

  -- Remove the broadofficer assignment
  DELETE FROM public.broadcast_officers
  WHERE officer_id = p_officer_id AND broadcaster_id = p_broadcaster_id;
END;
$$;
