
CREATE OR REPLACE FUNCTION public.clear_broadcast_of_guests(p_stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
  v_broadcaster_id UUID;
BEGIN
  -- Get the role of the user calling the function
  SELECT role INTO v_caller_role FROM public.user_profiles WHERE id = auth.uid();

  -- Check if the caller has the required permissions
  IF v_caller_role NOT IN ('admin', 'lead_troll_officer') THEN
    RAISE EXCEPTION 'Only Admins and Lead Troll Officers can clear the broadcast.';
  END IF;

  -- Get the broadcaster_id for the stream
  SELECT broadcaster_id INTO v_broadcaster_id
  FROM public.streams
  WHERE id = p_stream_id;

  -- Delete all guests from the broadcast_seats table for this stream
  DELETE FROM public.broadcast_seats
  WHERE room = p_stream_id::text AND user_id != v_broadcaster_id;

END;
$$;
