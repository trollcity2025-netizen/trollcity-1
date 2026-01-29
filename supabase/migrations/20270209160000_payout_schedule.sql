-- Migration: Payout Schedule and Hold System
-- 1. Add columns for Hold/Release logic
-- 2. Update submit_cashout_request for New User 7-day hold
-- 3. Add RPC for Admin Hold/Release

-- 1. Add Columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashout_requests' AND column_name = 'is_held') THEN
        ALTER TABLE public.cashout_requests ADD COLUMN is_held BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashout_requests' AND column_name = 'held_reason') THEN
        ALTER TABLE public.cashout_requests ADD COLUMN held_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashout_requests' AND column_name = 'release_date') THEN
        ALTER TABLE public.cashout_requests ADD COLUMN release_date TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashout_requests' AND column_name = 'is_new_user_hold') THEN
        ALTER TABLE public.cashout_requests ADD COLUMN is_new_user_hold BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Update submit_cashout_request
CREATE OR REPLACE FUNCTION public.submit_cashout_request(
    p_user_id UUID,
    p_amount_coins BIGINT,
    p_usd_value NUMERIC,
    p_provider TEXT,
    p_delivery_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req_id UUID;
    v_has_prior_payouts BOOLEAN;
    v_is_held BOOLEAN := false;
    v_held_reason TEXT := NULL;
    v_release_date TIMESTAMPTZ := NULL;
    v_is_new_user_hold BOOLEAN := false;
BEGIN
    -- Check for prior successful payouts to determine if new user hold applies
    SELECT EXISTS (
        SELECT 1 FROM public.cashout_requests 
        WHERE user_id = p_user_id 
        AND status IN ('paid', 'fulfilled')
    ) INTO v_has_prior_payouts;

    IF NOT v_has_prior_payouts THEN
        v_is_held := true;
        v_held_reason := 'New User 7 Day Hold';
        v_release_date := NOW() + INTERVAL '7 days';
        v_is_new_user_hold := true;
    END IF;

    -- Create Request
    INSERT INTO public.cashout_requests (
        user_id, 
        requested_coins, 
        usd_value, 
        payout_method, 
        payout_details, 
        status,
        is_held,
        held_reason,
        release_date,
        is_new_user_hold
    ) VALUES (
        p_user_id, 
        p_amount_coins, 
        p_usd_value, 
        p_provider, 
        p_delivery_method, 
        'pending',
        v_is_held,
        v_held_reason,
        v_release_date,
        v_is_new_user_hold
    ) RETURNING id INTO v_req_id;

    -- Lock Coins
    BEGIN
        PERFORM public.troll_bank_escrow_coins(p_user_id, p_amount_coins, v_req_id);
    EXCEPTION WHEN OTHERS THEN
        -- If escrow fails, delete the request and re-raise
        DELETE FROM public.cashout_requests WHERE id = v_req_id;
        RAISE EXCEPTION 'Failed to escrow coins: %', SQLERRM;
    END;

    RETURN json_build_object(
        'success', true, 
        'request_id', v_req_id, 
        'is_held', v_is_held,
        'release_date', v_release_date
    );
END;
$$;

-- 3. RPC: Toggle Hold Status
CREATE OR REPLACE FUNCTION public.toggle_cashout_hold(
    p_request_id UUID,
    p_admin_id UUID,
    p_hold BOOLEAN,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    -- Check admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_admin_id AND (role = 'admin' OR is_admin = true OR role = 'secretary')
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN RAISE EXCEPTION 'Access denied'; END IF;

    UPDATE public.cashout_requests
    SET 
        is_held = p_hold,
        held_reason = CASE WHEN p_hold THEN COALESCE(p_reason, 'Admin Hold') ELSE NULL END,
        release_date = CASE WHEN p_hold THEN NULL ELSE NOW() END -- If released, maybe set release date to now? Or null? Let's just clear it if it was a hold.
        -- Actually, if we release a new user hold, we might want to clear the release_date.
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
