CREATE OR REPLACE FUNCTION assign_broadofficer(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_broadcaster_id UUID;
BEGIN
  v_broadcaster_id := auth.uid();
  
  INSERT INTO public.stream_moderators (broadcaster_id, user_id)
  VALUES (v_broadcaster_id, p_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;
