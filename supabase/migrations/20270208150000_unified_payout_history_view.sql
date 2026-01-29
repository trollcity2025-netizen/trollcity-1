-- Unified view for user payout history (Manual + Automated)

DROP VIEW IF EXISTS public.payout_history_view;

CREATE OR REPLACE VIEW public.payout_history_view AS
SELECT
    id,
    user_id,
    COALESCE(requested_coins, coins_redeemed, 0) AS coins_redeemed,
    COALESCE(amount_usd, cash_amount, 0) AS cash_amount,
    status,
    created_at,
    processed_at,
    'manual' AS type,
    NULL::uuid AS run_id
FROM
    public.payout_requests
UNION ALL
SELECT
    id,
    user_id,
    amount_coins AS coins_redeemed,
    amount_usd AS cash_amount,
    status,
    created_at,
    processed_at,
    'automated' AS type,
    run_id
FROM
    public.payouts;

-- Grant permissions
GRANT SELECT ON public.payout_history_view TO authenticated;
GRANT SELECT ON public.payout_history_view TO service_role;
