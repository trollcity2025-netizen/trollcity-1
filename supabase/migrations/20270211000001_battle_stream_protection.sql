-- Battle Stream Protection System
-- Prevents streams from ending during active battles
-- Adds comprehensive audit logging for stream end operations

-- 1. Update end_stream RPC with battle protection
DROP FUNCTION IF EXISTS public.end_stream(UUID);

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
    -- Check ownership and battle status
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
            INSERT INTO public.audit_logs (action, user_id, details)
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
        INSERT INTO public.audit_logs (action, user_id, details)
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
    INSERT INTO public.audit_logs (action, user_id, details)
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

GRANT EXECUTE ON FUNCTION public.end_stream(UUID) TO authenticated;

-- 2. Add helper function to check if a stream is in battle mode
CREATE OR REPLACE FUNCTION public.is_stream_in_battle(p_stream_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_battle_id UUID;
    v_is_in_battle BOOLEAN := FALSE;
BEGIN
    SELECT battle_id INTO v_battle_id
    FROM public.streams
    WHERE id = p_stream_id;

    IF v_battle_id IS NOT NULL THEN
        -- Check if battle is active
        IF EXISTS (
            SELECT 1 FROM public.battles 
            WHERE id = v_battle_id 
            AND status IN ('pending', 'active')
        ) THEN
            v_is_in_battle := TRUE;
        END IF;
    END IF;

    RETURN v_is_in_battle;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_stream_in_battle(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_stream_in_battle(UUID) TO anon;

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_streams_battle_id ON public.streams(battle_id) WHERE battle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_battles_status ON public.battles(status) WHERE status IN ('pending', 'active');
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- 4. Add RLS policy for audit_logs if needed
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- 5. Add comment documentation
COMMENT ON FUNCTION public.end_stream(UUID) IS 
'Ends a stream with battle protection. Prevents ending streams that are in active battles. 
Only stream owner or admin can end a stream. All operations are logged to audit_logs table.';

COMMENT ON FUNCTION public.is_stream_in_battle(UUID) IS 
'Helper function to check if a stream is currently in an active battle.
Returns true if the stream has a battle_id and that battle is pending or active.';
