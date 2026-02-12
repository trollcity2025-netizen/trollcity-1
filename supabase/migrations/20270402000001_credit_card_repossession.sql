-- Add Credit Card Default Repossession System
-- Extends existing repossession system to handle credit card defaults

-- 1. Add credit card tracking fields to user_profiles for default detection
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS last_credit_payment_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS credit_default_warning_sent BOOLEAN DEFAULT FALSE;

-- 2. Function to check for credit card defaults and trigger repossession
CREATE OR REPLACE FUNCTION public.check_credit_card_defaults()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_admin_id UUID := '8dff9f37-21b5-4b8e-adc2-b9286874be1a'::uuid;
    v_property RECORD;
    v_vehicle RECORD;
BEGIN
    -- Find users with credit card debt that's been overdue for 60+ days
    FOR v_user IN
        SELECT 
            id,
            username,
            credit_used,
            credit_limit,
            last_credit_payment_at,
            created_at
        FROM public.user_profiles
        WHERE credit_used > 0
        AND (
            -- Case 1: Debt exceeds credit limit
            credit_used > credit_limit
            OR
            -- Case 2: No payment in 60+ days
            (last_credit_payment_at IS NULL AND credit_used > 0 AND created_at < NOW() - INTERVAL '60 days')
            OR
            (last_credit_payment_at < NOW() - INTERVAL '60 days')
        )
    LOOP
        -- First, try to repossess a property
        SELECT * INTO v_property
        FROM public.properties
        WHERE owner_user_id = v_user.id
        AND is_repossessed = FALSE
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_property.id IS NOT NULL THEN
            -- Repossess property
            UPDATE public.properties
            SET is_repossessed = TRUE,
                repossessed_at = NOW(),
                repossessed_by = v_admin_id,
                repossession_reason = 'Credit card default - Debt of ' || v_user.credit_used || ' coins unpaid for 60+ days'
            WHERE id = v_property.id;

            -- Create court summon
            INSERT INTO public.loan_default_summons (
                user_id,
                loan_id,
                property_id,
                summon_type,
                status,
                reason,
                amount_owed,
                created_by,
                court_date
            )
            SELECT 
                v_user.id,
                l.id, -- Use any active loan, or create a synthetic one
                v_property.id,
                'property_repossession',
                'served',
                'Credit card default - Property repossessed for ' || v_user.credit_used || ' coins debt',
                v_user.credit_used,
                v_admin_id,
                NOW() + INTERVAL '7 days'
            FROM public.loans l
            WHERE l.user_id = v_user.id
            AND l.status = 'active'
            LIMIT 1;

            -- Log admin action
            INSERT INTO public.admin_actions (
                admin_id,
                action_type,
                target_id,
                details
            ) VALUES (
                v_admin_id,
                'credit_card_repo',
                v_user.id,
                json_build_object(
                    'property_id', v_property.id,
                    'property_name', v_property.property_name,
                    'credit_debt', v_user.credit_used,
                    'reason', 'credit_card_default'
                )
            );
            
            CONTINUE; -- Move to next user
        END IF;

        -- If no property, try to repossess a vehicle
        SELECT uv.*, vc.name as vehicle_name INTO v_vehicle
        FROM public.user_vehicles uv
        JOIN public.vehicles_catalog vc ON uv.catalog_id = vc.id
        WHERE uv.user_id = v_user.id
        AND uv.is_repossessed = FALSE
        ORDER BY uv.created_at DESC
        LIMIT 1;

        IF v_vehicle.id IS NOT NULL THEN
            -- Repossess vehicle
            UPDATE public.user_vehicles
            SET is_repossessed = TRUE,
                repossessed_at = NOW(),
                repossessed_by = v_admin_id,
                repossession_reason = 'Credit card default - Debt of ' || v_user.credit_used || ' coins unpaid for 60+ days'
            WHERE id = v_vehicle.id;

            -- Create court summon
            INSERT INTO public.loan_default_summons (
                user_id,
                loan_id,
                vehicle_id,
                summon_type,
                status,
                reason,
                amount_owed,
                created_by,
                court_date
            )
            SELECT 
                v_user.id,
                l.id,
                v_vehicle.id,
                'vehicle_repossession',
                'served',
                'Credit card default - Vehicle repossessed for ' || v_user.credit_used || ' coins debt',
                v_user.credit_used,
                v_admin_id,
                NOW() + INTERVAL '7 days'
            FROM public.loans l
            WHERE l.user_id = v_user.id
            AND l.status = 'active'
            LIMIT 1;

            -- Log admin action
            INSERT INTO public.admin_actions (
                admin_id,
                action_type,
                target_id,
                details
            ) VALUES (
                v_admin_id,
                'credit_card_repo',
                v_user.id,
                json_build_object(
                    'vehicle_id', v_vehicle.id,
                    'vehicle_name', v_vehicle.vehicle_name,
                    'credit_debt', v_user.credit_used,
                    'reason', 'credit_card_default'
                )
            );
        END IF;

        -- Decrease credit score by 50 points for default
        UPDATE public.user_profiles
        SET credit_score = GREATEST(0, credit_score - 50)
        WHERE id = v_user.id;

    END LOOP;
END;
$$;

-- 3. Update pay_credit_card function to track last payment date
CREATE OR REPLACE FUNCTION public.pay_credit_card(p_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_admin_id UUID := '8dff9f37-21b5-4b8e-adc2-b9286874be1a'::uuid;
    v_profile RECORD;
    v_pay_amount BIGINT;
    v_interest_amount BIGINT;
    v_new_credit_used BIGINT;
    v_new_credit_score INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Amount must be positive');
    END IF;

    SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;

    IF v_profile.credit_used <= 0 THEN
         RETURN jsonb_build_object('success', false, 'message', 'No credit debt to pay');
    END IF;

    -- Cap payment to debt
    v_pay_amount := LEAST(p_amount, v_profile.credit_used);

    -- Check Coin Balance
    IF v_profile.troll_coins < v_pay_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient Troll Coins');
    END IF;

    -- Calculate 8% interest/fee on the payment amount
    v_interest_amount := CEIL(v_pay_amount * 0.08);

    -- Execute Payment (deduct from user's coins)
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_pay_amount,
        credit_used = credit_used - v_pay_amount,
        last_credit_payment_at = NOW(),
        credit_default_warning_sent = FALSE
    WHERE id = v_user_id
    RETURNING credit_used INTO v_new_credit_used;

    -- Increase user's credit score (up to 800)
    UPDATE public.user_profiles
    SET credit_score = LEAST(credit_score + 5, 800)
    WHERE id = v_user_id
    RETURNING credit_score INTO v_new_credit_score;

    -- Send 8% interest to admin account
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_interest_amount
    WHERE id = v_admin_id;

    -- Log Ledger for user's payment
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, metadata)
    VALUES (
        v_user_id, 
        -v_pay_amount, 
        'repayment', 
        'credit_card_repay', 
        'Credit Card Repayment', 
        jsonb_build_object('remaining_debt', v_new_credit_used, 'interest_paid', v_interest_amount)
    );

    -- Log Ledger for admin's interest income
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, metadata)
    VALUES (
        v_admin_id, 
        v_interest_amount, 
        'revenue', 
        'credit_card_interest', 
        'Credit Card Interest from User Payment', 
        jsonb_build_object('payer', v_user_id, 'original_payment', v_pay_amount)
    );

    RETURN jsonb_build_object(
        'success', true, 
        'paid', v_pay_amount, 
        'interest_to_admin', v_interest_amount,
        'remaining_debt', v_new_credit_used,
        'new_credit_score', v_new_credit_score,
        'remaining_coins', v_profile.troll_coins - v_pay_amount
    );
END;
$$;

-- 4. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_credit_card_defaults() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_credit_card(BIGINT) TO authenticated;

-- 5. Add comment explaining the system
COMMENT ON FUNCTION public.check_credit_card_defaults() IS 
'Automated function to check for credit card defaults (60+ days overdue or exceeding limit) and trigger asset repossession. Should be run daily by a cron job or edge function.';
