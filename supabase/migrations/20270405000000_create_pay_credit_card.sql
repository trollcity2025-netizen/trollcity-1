-- ==========================================
-- Migration: Create/Update pay_credit_card function
-- This ensures credit_score is updated atomically in both tables
-- ==========================================

-- Create the function if it doesn't exist, or replace if it does
CREATE OR REPLACE FUNCTION public.pay_credit_card(p_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
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

    -- First, get the new credit score increase (before update)
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

    -- SINGLE ATOMIC UPDATE with ALL fields including credit_score
    UPDATE public.user_profiles
    SET 
        troll_coins = troll_coins - v_pay_amount,
        credit_used = credit_used - v_pay_amount,
        last_credit_payment_at = NOW(),
        credit_default_warning_sent = FALSE,
        credit_score = v_new_credit_score
    WHERE id = v_user_id
    RETURNING credit_used INTO v_new_credit_used;

    -- Update user_credit table to keep scores in sync
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

    RETURN jsonb_build_object(
        'success', true,
        'amount_paid', v_pay_amount,
        'new_credit_used', v_new_credit_used,
        'new_credit_score', v_new_credit_score,
        'new_tier', v_new_tier
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.pay_credit_card(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_credit_card(BIGINT) TO service_role;

-- Sync existing data: Make sure user_profiles.credit_score matches user_credit.score
UPDATE public.user_profiles up
SET credit_score = uc.score
FROM public.user_credit uc
WHERE up.id = uc.user_id
  AND (up.credit_score IS DISTINCT FROM uc.score OR up.credit_score IS NULL);

-- Notify success
DO $$
BEGIN
    RAISE NOTICE '✅ pay_credit_card function created/updated successfully!';
    RAISE NOTICE '✅ Credit scores synced between user_profiles and user_credit tables';
END $$;
