CREATE OR REPLACE FUNCTION end_pod(pod_id_to_end UUID)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  UPDATE public.pod_rooms
  SET ended_at = now(), is_live = false
  WHERE id = pod_id_to_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;