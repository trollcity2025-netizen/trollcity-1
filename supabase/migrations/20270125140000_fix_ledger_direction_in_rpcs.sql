-- Fix missing direction in coin_ledger inserts in RPCs
-- This was lost in a previous migration (20270123100000_fix_function_search_paths.sql)
-- causing constraint violations.

-- 1. troll_bank_credit_coins
DROP FUNCTION IF EXISTS public.troll_bank_credit_coins(uuid, int, text, text, text, jsonb);
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

    RETURN json_build_object(
        'repay', v_repay_amount,
        'user_gets', v_user_gets,
        'new_loan_balance', v_new_loan_balance,
        'loan_status', v_loan_status
    );
END;
$$;

-- 2. troll_bank_spend_coins
DROP FUNCTION IF EXISTS public.troll_bank_spend_coins(uuid, int, text, text, text, jsonb);
CREATE OR REPLACE FUNCTION public.troll_bank_spend_coins(
  p_user_id uuid,
  p_amount int,
  p_bucket text default 'paid',
  p_source text default 'purchase',
  p_ref_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
SET search_path = ''
as $$
declare
  v_current_balance int;
  v_new_balance int;
  v_ledger_id uuid;
begin
  -- Validate amount
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be positive');
  end if;

  -- Lock user profile and check balance
  select troll_coins into v_current_balance
  from public.user_profiles
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'User not found');
  end if;

  if v_current_balance < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient funds', 'current_balance', v_current_balance);
  end if;

  -- Deduct coins
  v_new_balance := v_current_balance - p_amount;
  
  update public.user_profiles
  set troll_coins = v_new_balance
  where id = p_user_id;

  -- Insert into ledger (negative delta)
  insert into public.coin_ledger (
    user_id,
    delta,
    bucket,
    source,
    ref_id,
    metadata,
    direction
  ) values (
    p_user_id,
    -p_amount,
    p_bucket,
    p_source,
    p_ref_id,
    p_metadata,
    'out'
  ) returning id into v_ledger_id;

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'ledger_id', v_ledger_id
  );
end;
$$;
