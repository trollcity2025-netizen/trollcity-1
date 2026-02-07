-- Migration to add broadcast bypass trigger to troll_bank_credit_coins
-- If a user purchases >= 1000 coins, they automatically get broadcast bypass permission.

-- Redefine troll_bank_credit_coins with the new logic
CREATE OR REPLACE FUNCTION public.troll_bank_credit_coins(
    p_user_id uuid,
    p_coins int,
    p_bucket text,        -- 'paid' | 'gifted' | 'promo' | 'loan'
    p_source text,        -- 'coin_purchase' | 'gift' | 'admin_grant' | 'loan_disbursement' | etc.
    p_ref_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_balance bigint;
    v_loan_record record;
    v_repay_amount bigint := 0;
    v_user_gets bigint;
    v_new_loan_balance bigint;
    v_loan_status text;
    v_gift_repayment_enabled boolean := false;
BEGIN
    -- Validate p_coins > 0
    IF p_coins <= 0 THEN
        RAISE EXCEPTION 'Coins must be positive';
    END IF;

    -- Lock user profile row
    SELECT troll_coins INTO v_user_balance
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Lock active loan row if exists
    SELECT * INTO v_loan_record
    FROM public.loans
    WHERE user_id = p_user_id AND status = 'active'
    LIMIT 1
    FOR UPDATE;

    -- Check Feature Flags (Safely handle if table doesn't exist)
    BEGIN
        SELECT is_enabled INTO v_gift_repayment_enabled
        FROM public.bank_feature_flags
        WHERE key = 'gift_repayment_enabled';
    EXCEPTION WHEN OTHERS THEN
        v_gift_repayment_enabled := false;
    END;

    -- Determine repayment eligibility
    -- Eligible buckets: 'paid' (always), 'gifted' (if flag enabled)
    IF v_loan_record IS NOT NULL THEN
        IF p_bucket = 'paid' OR (p_bucket = 'gifted' AND v_gift_repayment_enabled = true) THEN
            -- repay = min(loan_balance, floor(p_coins * 0.50))
            v_repay_amount := LEAST(v_loan_record.balance, FLOOR(p_coins * 0.50)::bigint);
        END IF;
    END IF;

    v_user_gets := p_coins - v_repay_amount;

    -- Insert ledger rows
    -- a) Repayment
    IF v_repay_amount > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
        VALUES (p_user_id, -v_repay_amount, 'repayment', 'auto_repay', p_ref_id, p_metadata, 'out');

        -- Update loan
        UPDATE public.loans
        SET balance = balance - v_repay_amount,
            status = CASE WHEN balance - v_repay_amount <= 0 THEN 'paid' ELSE status END,
            closed_at = CASE WHEN balance - v_repay_amount <= 0 THEN now() ELSE closed_at END
        WHERE id = v_loan_record.id
        RETURNING balance, status INTO v_new_loan_balance, v_loan_status;

        -- Credit Admin Pool (Treasury) with Repayment
        BEGIN
            INSERT INTO public.admin_allocation_buckets (bucket_name) VALUES ('Treasury') ON CONFLICT DO NOTHING;
            
            UPDATE public.admin_allocation_buckets
            SET balance_coins = balance_coins + v_repay_amount
            WHERE bucket_name = 'Treasury';

            -- Audit Log for Repayment to Pool
            INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at)
            VALUES (v_repay_amount, 'Loan Repayment from ' || p_user_id, p_user_id, NOW());
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors if admin tables don't exist yet (robustness)
            NULL;
        END;
    ELSE
        v_new_loan_balance := CASE WHEN v_loan_record IS NOT NULL THEN v_loan_record.balance ELSE 0 END;
        v_loan_status := CASE WHEN v_loan_record IS NOT NULL THEN v_loan_record.status ELSE 'none' END;
    END IF;

    -- b) Credit
    IF v_user_gets > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
        VALUES (p_user_id, v_user_gets, p_bucket, p_source, p_ref_id, p_metadata, 'in');
    END IF;

    -- Update user balance (troll_coins)
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_user_gets
    WHERE id = p_user_id;

    -- ========================================================================
    -- BROADCAST BYPASS TRIGGER
    -- If user purchases >= 1000 coins, grant bypass_broadcast_restriction
    -- ========================================================================
    IF p_coins >= 1000 AND p_source IN ('coin_purchase', 'manual_purchase') THEN
        UPDATE public.user_profiles
        SET bypass_broadcast_restriction = true
        WHERE id = p_user_id;
    END IF;

    RETURN json_build_object(
        'repay', v_repay_amount,
        'user_gets', v_user_gets,
        'new_loan_balance', v_new_loan_balance,
        'loan_status', v_loan_status
    );
END;
$$;
