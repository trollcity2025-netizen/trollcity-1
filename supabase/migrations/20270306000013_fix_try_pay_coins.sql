-- Redefine try_pay_coins to ensure it is robust and uses row locking
-- This fixes potential race conditions and ensures the balance update is atomic

CREATE OR REPLACE FUNCTION public.try_pay_coins(p_user_id UUID, p_amount BIGINT, p_reason TEXT, p_metadata JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance BIGINT;
    v_new_balance BIGINT;
BEGIN
    -- Lock the row to prevent race conditions
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;
    
    IF v_balance IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_balance >= p_amount THEN
        v_new_balance := v_balance - p_amount;
        
        -- Deduct
        UPDATE public.user_profiles 
        SET troll_coins = v_new_balance,
            updated_at = NOW()
        WHERE id = p_user_id;
        
        -- Ledger
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, metadata)
        VALUES (p_user_id, -p_amount, 'spend', p_reason, p_metadata);
        
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

-- Ensure try_pay_coins_secure uses this function (it already does, but just to be safe we don't need to change it if it just calls this)
-- But we can grant execute just in case
GRANT EXECUTE ON FUNCTION public.try_pay_coins(UUID, BIGINT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_pay_coins(UUID, BIGINT, TEXT, JSONB) TO service_role;
