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

CREATE OR REPLACE FUNCTION public.end_stream(p_stream_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stream_owner UUID;
    v_battle_id UUID;
    v_is_admin BOOLEAN := FALSE;
BEGIN
    -- Check ownership
    SELECT user_id, battle_id INTO v_stream_owner, v_battle_id
    FROM public.streams
    WHERE id = p_stream_id;

    IF v_stream_owner IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Stream not found');
    END IF;

    -- Check if user is admin
    SELECT (role = 'admin' OR is_admin = true) INTO v_is_admin
    FROM public.user_profiles 
    WHERE id = auth.uid();

    -- BATTLE PROTECTION: Prevent ending streams that are in active battles
    IF v_battle_id IS NOT NULL THEN
        -- Check if battle is still active
        IF EXISTS (
            SELECT 1 FROM public.battles 
            WHERE id = v_battle_id 
            AND status IN ('pending', 'active')
        ) THEN
            -- Log the attempt
            INSERT INTO public.audit_logs (action, user_id, metadata)
            VALUES (
                'end_stream_blocked_battle',
                auth.uid(),
                jsonb_build_object(
                    'stream_id', p_stream_id,
                    'battle_id', v_battle_id,
                    'reason', 'Stream is in active battle'
                )
            );
            
            RETURN jsonb_build_object(
                'success', false, 
                'message', 'Cannot end stream during active battle. End the battle first.',
                'battle_id', v_battle_id
            );
        END IF;
    END IF;

    -- Allow owner or admin
    IF v_stream_owner != auth.uid() AND NOT v_is_admin THEN
        -- Log unauthorized attempt
        INSERT INTO public.audit_logs (action, user_id, metadata)
        VALUES (
            'end_stream_unauthorized',
            auth.uid(),
            jsonb_build_object(
                'stream_id', p_stream_id,
                'stream_owner', v_stream_owner
            )
        );
        
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    -- Log the stream end
    INSERT INTO public.audit_logs (action, user_id, metadata)
    VALUES (
        'end_stream',
        auth.uid(),
        jsonb_build_object(
            'stream_id', p_stream_id,
            'stream_owner', v_stream_owner,
            'ended_by_admin', v_is_admin
        )
    );

    -- Update stream
    UPDATE public.streams
    SET 
        status = 'ended',
        is_live = false,
        ended_at = NOW()
    WHERE id = p_stream_id;

    -- Clean up viewers
    DELETE FROM public.stream_viewers WHERE stream_id = p_stream_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
