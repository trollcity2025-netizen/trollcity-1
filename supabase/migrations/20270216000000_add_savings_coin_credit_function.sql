CREATE OR REPLACE FUNCTION public.credit_user_coins_with_savings_rule(
    p_user_id UUID,
    p_amount_received BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_coins_to_savings BIGINT;
    v_coins_to_spendable BIGINT;
BEGIN
    IF p_amount_received <= 0 THEN
        RETURN;
    END IF;

    -- Calculate coins for savings (1 in 5 rule)
    v_coins_to_savings := FLOOR(p_amount_received / 5);
    v_coins_to_spendable := p_amount_received - v_coins_to_savings;

    -- Update user's balances
    UPDATE public.user_profiles
    SET
        troll_coins = COALESCE(troll_coins, 0) + v_coins_to_spendable,
        earned_balance = COALESCE(earned_balance, 0) + v_coins_to_savings,
        total_earned_coins = COALESCE(total_earned_coins, 0) + p_amount_received -- Total earned should reflect full amount
    WHERE id = p_user_id;

    -- Optionally, log this internal transfer if needed for auditing,
    -- but the calling functions should handle their own transaction logging.
END;
$$;