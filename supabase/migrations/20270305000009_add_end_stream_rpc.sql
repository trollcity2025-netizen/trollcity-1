-- Function to end a stream safely
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature 
             FROM pg_proc 
             WHERE proname = 'end_stream' 
             AND pronamespace = 'public'::regnamespace 
    LOOP 
        EXECUTE 'DROP FUNCTION ' || r.func_signature; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION public.end_stream(stream_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stream_owner UUID;
BEGIN
    -- Check ownership
    SELECT user_id INTO v_stream_owner
    FROM public.streams
    WHERE id = stream_id;

    IF v_stream_owner IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Stream not found');
    END IF;

    -- Allow owner or admin
    IF v_stream_owner != auth.uid() AND NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    -- Update stream
    UPDATE public.streams
    SET 
        status = 'ended',
        is_live = false,
        ended_at = NOW()
    WHERE id = stream_id;

    -- Clean up viewers
    DELETE FROM public.stream_viewers WHERE stream_id = stream_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
