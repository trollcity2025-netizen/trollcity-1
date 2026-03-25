-- Function to credit seller after marketplace purchase
-- This credits the seller their earnings after a purchase is made
CREATE OR REPLACE FUNCTION credit_marketplace_seller(
    p_seller_id UUID,
    p_amount BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_seller_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
        RETURN FALSE;
    END IF;

    -- Credit the seller's wallet
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins + p_amount
    WHERE id = p_seller_id;

    RETURN TRUE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION credit_marketplace_seller(UUID, BIGINT) TO service_role, authenticated;