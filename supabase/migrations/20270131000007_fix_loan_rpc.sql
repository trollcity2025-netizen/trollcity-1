
-- Fix Troll Bank Apply Loan RPC
-- Adds search_path for security and reliability
-- Ensures consistent behavior with credit_coins

CREATE OR REPLACE FUNCTION public.troll_bank_apply_for_loan(
    p_user_id uuid,
    p_requested_coins int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user record;
    v_active_loan_exists boolean;
    v_account_age_days int;
    v_max_allowed bigint;
    v_tier_name text;
    v_result json;
BEGIN
    -- Get user info
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'reason', 'User not found');
    END IF;

    -- Check active loan (One active loan at a time)
    SELECT EXISTS (
        SELECT 1 FROM public.loans WHERE user_id = p_user_id AND status = 'active'
    ) INTO v_active_loan_exists;

    IF v_active_loan_exists THEN
        RETURN json_build_object('success', false, 'reason', 'Active loan exists');
    END IF;

    -- Calculate account age
    v_account_age_days := EXTRACT(DAY FROM (now() - v_user.created_at));

    -- Determine Max Loan Amount based on Tiers
    -- Select the highest tier the user qualifies for
    SELECT max_loan_coins, tier_name INTO v_max_allowed, v_tier_name
    FROM public.bank_tiers
    WHERE min_tenure_days <= v_account_age_days
    ORDER BY min_tenure_days DESC
    LIMIT 1;
    
    -- Default to 0 if no tier matches
    v_max_allowed := COALESCE(v_max_allowed, 0);

    IF p_requested_coins > v_max_allowed THEN
        RETURN json_build_object(
            'success', false, 
            'reason', 'Requested amount exceeds limit based on tenure', 
            'limit', v_max_allowed,
            'current_tenure_days', v_account_age_days,
            'tier', v_tier_name
        );
    END IF;

    -- Create application (Auto-approved)
    INSERT INTO public.loan_applications (user_id, requested_coins, status, auto_approved, reason)
    VALUES (p_user_id, p_requested_coins, 'approved', true, 'Auto-approved by Troll Bank Tier System');

    -- Create active loan
    INSERT INTO public.loans (user_id, principal, balance, status)
    VALUES (p_user_id, p_requested_coins, p_requested_coins, 'active');

    -- Disburse coins
    -- Calls the credit function internally
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        p_requested_coins,
        'loan',
        'loan_disbursement',
        NULL, -- No specific ref_id needed for generic loan
        jsonb_build_object('tier', v_tier_name, 'tenure', v_account_age_days)
    ) INTO v_result;

    RETURN json_build_object(
        'success', true,
        'loan_details', v_result,
        'principal', p_requested_coins,
        'tier', v_tier_name
    );
END;
$$;
