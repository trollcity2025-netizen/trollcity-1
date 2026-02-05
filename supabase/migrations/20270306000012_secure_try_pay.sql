-- Create a secure wrapper for try_pay_coins to be called from client
-- This ensures the frontend can safely call coin deduction logic

CREATE OR REPLACE FUNCTION public.try_pay_coins_secure(
    p_amount BIGINT,
    p_reason TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Call the internal function
    RETURN public.try_pay_coins(v_user_id, p_amount, p_reason, p_metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_pay_coins_secure(BIGINT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_pay_coins_secure(BIGINT, TEXT, JSONB) TO service_role;
