-- Allow all authenticated users to start a broadcast

CREATE OR REPLACE FUNCTION public.can_start_broadcast(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Always allow broadcasting for all users
    RETURN true;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.can_start_broadcast(UUID) TO authenticated;

-- Grant to service_role for edge functions
GRANT EXECUTE ON FUNCTION public.can_start_broadcast(UUID) TO service_role;
