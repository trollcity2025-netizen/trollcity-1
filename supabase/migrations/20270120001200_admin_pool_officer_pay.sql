-- RPC: Pay Officer
CREATE OR REPLACE FUNCTION public.troll_bank_pay_officer(
    p_officer_id UUID,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_pay_rate BIGINT;
    v_bucket_bal BIGINT;
    v_officer_name TEXT;
    v_officer_role TEXT;
    v_is_lead_officer BOOLEAN;
    v_effective_pay BIGINT;
    v_admin_pool_id UUID;
BEGIN
    -- Check admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_admin_id AND (role = 'admin' OR is_admin = true OR role = 'secretary')
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Get Officer Name
    SELECT username, role, is_lead_officer
    INTO v_officer_name, v_officer_role, v_is_lead_officer
    FROM public.user_profiles
    WHERE id = p_officer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Officer not found';
    END IF;

    -- Get Pay Rate
    SELECT (setting_value->>'officer_pay_rate')::BIGINT INTO v_pay_rate
    FROM public.admin_app_settings
    WHERE setting_key = 'officer_pay_rate';
    
    -- Default if not set or invalid
    IF v_pay_rate IS NULL OR v_pay_rate <= 0 THEN
        v_pay_rate := 1000;
    END IF;

    -- Apply 10% bonus for secretaries and lead officers
    v_effective_pay := v_pay_rate;
    IF v_officer_role = 'secretary' OR v_officer_role = 'lead_troll_officer' OR COALESCE(v_is_lead_officer, false) THEN
        v_effective_pay := v_pay_rate + (v_pay_rate / 10);
    END IF;

    -- Check Bucket Balance
    SELECT balance_coins INTO v_bucket_bal 
    FROM public.admin_pool_buckets 
    WHERE bucket_name = 'Officer Pay';

    IF v_bucket_bal < v_effective_pay THEN
        RAISE EXCEPTION 'Insufficient funds in Officer Pay bucket (Need %, Have %)', v_effective_pay, v_bucket_bal;
    END IF;

    -- 1. Deduct from Bucket
    UPDATE public.admin_pool_buckets 
    SET balance_coins = balance_coins - v_effective_pay, updated_at = NOW()
    WHERE bucket_name = 'Officer Pay';

    -- 2. Credit Officer (Coin Ledger)
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, reason)
    VALUES (
        p_officer_id, 
        v_effective_pay, 
        'paid', 
        'officer_pay', 
        p_admin_id::text, 
        'Officer Pay Period'
    );

    -- 3. Update officer spendable and earned balances
    -- Update officer spendable and earned balances using the savings rule
    PERFORM public.credit_user_coins_with_savings_rule(p_officer_id, v_effective_pay);

    -- 4. Update Admin Pool liability and ledger
    SELECT id INTO v_admin_pool_id FROM public.admin_pool LIMIT 1;
    IF v_admin_pool_id IS NOT NULL THEN
        UPDATE public.admin_pool
        SET total_liability_coins = total_liability_coins + v_effective_pay,
            updated_at = NOW()
        WHERE id = v_admin_pool_id;
    END IF;

    INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at) 
    VALUES (
        v_effective_pay, 
        'Paid Officer @' || v_officer_name, 
        p_officer_id, 
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'amount', v_effective_pay);
END;
$$;

-- Enable RLS and Add Policy for admin_pool_ledger
ALTER TABLE public.admin_pool_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin pool ledger" ON public.admin_pool_ledger;
CREATE POLICY "Admins can view admin pool ledger"
  ON public.admin_pool_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'secretary')
    )
  );
