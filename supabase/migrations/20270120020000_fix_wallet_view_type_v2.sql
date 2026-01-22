-- Fix type mismatch in admin wallet view RPC
-- The issue is that SUM() returns NUMERIC, but the function is defined to return BIGINT.
-- We must explicitly cast the results to BIGINT.


DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_ledger' AND column_name = 'delta'
    ) THEN
        DROP FUNCTION IF EXISTS public.get_admin_user_wallets_secure(text, int);
        DROP FUNCTION IF EXISTS public.get_admin_user_wallets_secure(text, int, int);
        DROP FUNCTION IF EXISTS public.get_admin_user_wallets_secure();

        CREATE OR REPLACE FUNCTION public.get_admin_user_wallets_secure(
            p_search text DEFAULT NULL,
            p_limit int DEFAULT 50
        )
        RETURNS TABLE (
            user_id uuid,
            username text,
            total_coins bigint,
            escrowed_coins bigint,
            available_coins bigint,
            is_cashout_eligible boolean
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            v_is_admin boolean;
        BEGIN
            -- Check if requesting user is admin
            SELECT EXISTS (
                SELECT 1 FROM public.user_profiles 
                WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'secretary')
            ) INTO v_is_admin;

            IF NOT v_is_admin THEN
                RAISE EXCEPTION 'Access denied';
            END IF;

            RETURN QUERY
            WITH ledger_stats AS (
                SELECT 
                    cl.user_id,
                    COALESCE(SUM(cl.delta), 0)::bigint as total_balance,
                    COALESCE(SUM(CASE WHEN cl.bucket = 'escrow' THEN cl.delta ELSE 0 END), 0)::bigint as escrow_balance
                FROM 
                    public.coin_ledger cl
                GROUP BY 
                    cl.user_id
            )
            SELECT 
                u.id as user_id,
                u.username,
                COALESCE(ls.total_balance, 0)::bigint as total_coins,
                COALESCE(ls.escrow_balance, 0)::bigint as escrowed_coins,
                (COALESCE(ls.total_balance, 0) - COALESCE(ls.escrow_balance, 0))::bigint as available_coins,
                (COALESCE(ls.total_balance, 0) >= 12000) as is_cashout_eligible
            FROM 
                public.user_profiles u
            LEFT JOIN 
                ledger_stats ls ON u.id = ls.user_id
            WHERE 
                (p_search IS NULL OR u.username ILIKE '%' || p_search || '%')
            ORDER BY 
                is_cashout_eligible DESC,
                total_coins DESC
            LIMIT p_limit;
        END;
        $$;
    END IF;
END$migration$;

GRANT EXECUTE ON FUNCTION public.get_admin_user_wallets_secure(text, int) TO authenticated;
