-- Migration: Unify Credit Score System
-- Problem: pay_credit_card() and check_credit_card_defaults() update user_profiles.credit_score
-- but the frontend reads from user_credit table, causing stale/400 scores everywhere.
-- Fix: Update both tables in sync + backfill existing data.

-- ==========================================
-- 1. Backfill: Sync user_profiles.credit_score -> user_credit.score
--    For any user whose user_profiles.credit_score differs from user_credit.score,
--    take the higher value (the most up-to-date one).
-- ==========================================
INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
SELECT
    up.id,
    up.credit_score,
    CASE
        WHEN up.credit_score < 300 THEN 'Untrusted'
        WHEN up.credit_score < 450 THEN 'Shaky'
        WHEN up.credit_score < 600 THEN 'Building'
        WHEN up.credit_score < 700 THEN 'Reliable'
        WHEN up.credit_score < 800 THEN 'Trusted'
        ELSE 'Elite'
    END,
    0,
    NOW()
FROM public.user_profiles up
WHERE up.credit_score IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_credit uc WHERE uc.user_id = up.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- For existing user_credit rows, update score to the max of both sources
UPDATE public.user_credit uc
SET
    score = GREATEST(uc.score, COALESCE(up.credit_score, uc.score)),
    tier = CASE
        WHEN GREATEST(uc.score, COALESCE(up.credit_score, uc.score)) < 300 THEN 'Untrusted'
        WHEN GREATEST(uc.score, COALESCE(up.credit_score, uc.score)) < 450 THEN 'Shaky'
        WHEN GREATEST(uc.score, COALESCE(up.credit_score, uc.score)) < 600 THEN 'Building'
        WHEN GREATEST(uc.score, COALESCE(up.credit_score, uc.score)) < 700 THEN 'Reliable'
        WHEN GREATEST(uc.score, COALESCE(up.credit_score, uc.score)) < 800 THEN 'Trusted'
        ELSE 'Elite'
    END,
    updated_at = NOW()
FROM public.user_profiles up
WHERE uc.user_id = up.id
  AND up.credit_score IS NOT NULL
  AND up.credit_score <> uc.score;

-- Also sync user_profiles.credit_score from user_credit for consistency
UPDATE public.user_profiles up
SET credit_score = uc.score
FROM public.user_credit uc
WHERE up.id = uc.user_id
  AND (up.credit_score IS NULL OR up.credit_score <> uc.score);

-- ==========================================
-- 2. Fix pay_credit_card() - Also update user_credit table
-- ==========================================
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
    v_new_tier TEXT;
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
    v_new_credit_score := LEAST(COALESCE(v_profile.credit_score, 400) + 5, 800);

    -- Compute new tier
    v_new_tier := CASE
        WHEN v_new_credit_score < 300 THEN 'Untrusted'
        WHEN v_new_credit_score < 450 THEN 'Shaky'
        WHEN v_new_credit_score < 600 THEN 'Building'
        WHEN v_new_credit_score < 700 THEN 'Reliable'
        WHEN v_new_credit_score < 800 THEN 'Trusted'
        ELSE 'Elite'
    END;

    -- Update BOTH tables to keep scores in sync
    UPDATE public.user_profiles
    SET credit_score = v_new_credit_score
    WHERE id = v_user_id;

    INSERT INTO public.user_credit (user_id, score, tier, updated_at, last_event_at)
    VALUES (v_user_id, v_new_credit_score, v_new_tier, NOW(), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        score = v_new_credit_score,
        tier = v_new_tier,
        updated_at = NOW(),
        last_event_at = NOW();

    -- Log credit event
    INSERT INTO public.credit_events (user_id, event_type, delta, metadata)
    VALUES (
        v_user_id,
        'credit_card_payment',
        5,
        jsonb_build_object('payment_amount', v_pay_amount, 'remaining_debt', v_new_credit_used)
    );

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

-- ==========================================
-- 3. Fix check_credit_card_defaults() - Also update user_credit table
-- ==========================================
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
    v_new_score INTEGER;
    v_new_tier TEXT;
BEGIN
    -- Find users with credit card debt that's been overdue for 60+ days
    FOR v_user IN
        SELECT
            id,
            username,
            credit_used,
            credit_limit,
            credit_score,
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
                user_id, loan_id, property_id, summon_type, status, reason, amount_owed, created_by, court_date
            )
            SELECT
                v_user.id, l.id, v_property.id, 'property_repossession', 'served',
                'Credit card default - Property repossessed for ' || v_user.credit_used || ' coins debt',
                v_user.credit_used, v_admin_id, NOW() + INTERVAL '7 days'
            FROM public.loans l
            WHERE l.user_id = v_user.id AND l.status = 'active'
            LIMIT 1;

            -- Log admin action
            INSERT INTO public.admin_actions (admin_id, action_type, target_id, details)
            VALUES (v_admin_id, 'credit_card_repo', v_user.id,
                json_build_object('property_id', v_property.id, 'property_name', v_property.property_name,
                    'credit_debt', v_user.credit_used, 'reason', 'credit_card_default'));

            CONTINUE;
        END IF;

        -- If no property, try to repossess a vehicle
        SELECT uv.*, vc.name as vehicle_name INTO v_vehicle
        FROM public.user_vehicles uv
        JOIN public.vehicles_catalog vc ON uv.catalog_id = vc.id
        WHERE uv.user_id = v_user.id AND uv.is_repossessed = FALSE
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
                user_id, loan_id, vehicle_id, summon_type, status, reason, amount_owed, created_by, court_date
            )
            SELECT
                v_user.id, l.id, v_vehicle.id, 'vehicle_repossession', 'served',
                'Credit card default - Vehicle repossessed for ' || v_user.credit_used || ' coins debt',
                v_user.credit_used, v_admin_id, NOW() + INTERVAL '7 days'
            FROM public.loans l
            WHERE l.user_id = v_user.id AND l.status = 'active'
            LIMIT 1;

            -- Log admin action
            INSERT INTO public.admin_actions (admin_id, action_type, target_id, details)
            VALUES (v_admin_id, 'credit_card_repo', v_user.id,
                json_build_object('vehicle_id', v_vehicle.id, 'vehicle_name', v_vehicle.vehicle_name,
                    'credit_debt', v_user.credit_used, 'reason', 'credit_card_default'));
        END IF;

        -- Decrease credit score by 50 points for default (both tables)
        v_new_score := GREATEST(0, COALESCE(v_user.credit_score, 400) - 50);
        v_new_tier := CASE
            WHEN v_new_score < 300 THEN 'Untrusted'
            WHEN v_new_score < 450 THEN 'Shaky'
            WHEN v_new_score < 600 THEN 'Building'
            WHEN v_new_score < 700 THEN 'Reliable'
            WHEN v_new_score < 800 THEN 'Trusted'
            ELSE 'Elite'
        END;

        -- Update user_profiles
        UPDATE public.user_profiles
        SET credit_score = v_new_score
        WHERE id = v_user.id;

        -- Update user_credit (single source of truth for frontend)
        INSERT INTO public.user_credit (user_id, score, tier, updated_at, last_event_at)
        VALUES (v_user.id, v_new_score, v_new_tier, NOW(), NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
            score = v_new_score,
            tier = v_new_tier,
            updated_at = NOW(),
            last_event_at = NOW();

        -- Log credit event
        INSERT INTO public.credit_events (user_id, event_type, delta, metadata)
        VALUES (
            v_user.id,
            'credit_card_default',
            -50,
            jsonb_build_object('credit_debt', v_user.credit_used, 'reason', 'repossession_default')
        );

    END LOOP;
END;
$$;

-- ==========================================
-- 4. Grant permissions
-- ==========================================
GRANT EXECUTE ON FUNCTION public.pay_credit_card(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_credit_card_defaults() TO authenticated;
