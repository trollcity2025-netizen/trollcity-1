-- MASTER MIGRATION: Add Missing RPC Functions
-- Fixes for missing functions identified in code audit
-- Timestamp: 20270701000002

-- ============================================================================
-- 1. send_guest_gift - Guest/gift sending (anonymous/guest users)
-- ============================================================================
-- Drop all possible signatures to ensure clean slate
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT oid FROM pg_proc WHERE proname = 'send_guest_gift' AND pronamespace = 'public'::regnamespace) LOOP
        EXECUTE 'DROP FUNCTION public.send_guest_gift(' || pg_get_function_identity_arguments(r.oid) || ')';
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.send_guest_gift(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_stream_id UUID,
    p_gift_id TEXT,
    p_cost NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sender_balance NUMERIC;
    v_new_sender_balance NUMERIC;
    v_receiver_credit NUMERIC;
    v_total_cost NUMERIC;
BEGIN
    -- 1. Security Check
    IF p_sender_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Sender ID required for guest gifts');
    END IF;

    -- 2. Calculate Totals
    v_total_cost := p_cost;

    -- 3. Lock Sender Row & Check Balance
    SELECT troll_coins INTO v_sender_balance
    FROM public.user_profiles
    WHERE id = p_sender_id
    FOR UPDATE;

    IF v_sender_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Sender profile not found');
    END IF;

    IF v_sender_balance < v_total_cost THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Insufficient funds',
            'required', v_total_cost,
            'available', v_sender_balance
        );
    END IF;

    -- 4. Deduct from Sender
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_total_cost
    WHERE id = p_sender_id
    RETURNING troll_coins INTO v_new_sender_balance;

    -- Log Sender Transaction
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
    VALUES (
        p_sender_id,
        -v_total_cost,
        'paid',
        'guest_gift_sent',
        p_gift_id,
        jsonb_build_object('receiver_id', p_receiver_id, 'stream_id', p_stream_id),
        'out'
    );

    -- 5. Credit Receiver (95%)
    v_receiver_credit := FLOOR(v_total_cost * 0.95);
    
    IF v_receiver_credit > 0 THEN
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + v_receiver_credit,
            total_earned_coins = COALESCE(total_earned_coins, 0) + v_receiver_credit,
            updated_at = now()
        WHERE id = p_receiver_id;

        -- Log Receiver Transaction
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
        VALUES (
            p_receiver_id,
            v_receiver_credit,
            'earned',
            'gift_received',
            p_gift_id,
            jsonb_build_object('sender_id', p_sender_id, 'stream_id', p_stream_id),
            'in'
        );
        
        -- Update Broadcaster Stats
        INSERT INTO public.broadcaster_stats (user_id, total_gifts_24h, total_gifts_all_time, last_updated_at)
        VALUES (p_receiver_id, v_total_cost, v_total_cost, now())
        ON CONFLICT (user_id) DO UPDATE SET
            total_gifts_24h = broadcaster_stats.total_gifts_24h + EXCLUDED.total_gifts_24h,
            total_gifts_all_time = broadcaster_stats.total_gifts_all_time + EXCLUDED.total_gifts_all_time,
            last_updated_at = now();
    END IF;

    -- 6. Insert into stream_messages (System Message)
    IF p_stream_id IS NOT NULL THEN
        INSERT INTO public.stream_messages (stream_id, user_id, content, type)
        VALUES (p_stream_id, p_sender_id, 'GIFT_EVENT:' || p_gift_id || ':' || v_total_cost, 'system');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_sender_balance,
        'receiver_credited', v_receiver_credit
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_guest_gift(UUID, UUID, UUID, TEXT, NUMERIC) TO authenticated;

-- ============================================================================
-- 2. issue_warrant - Officer/Admin ability to issue warrants
-- ============================================================================
-- Drop all possible signatures to ensure clean slate
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT oid FROM pg_proc WHERE proname = 'issue_warrant' AND pronamespace = 'public'::regnamespace) LOOP
        EXECUTE 'DROP FUNCTION public.issue_warrant(' || pg_get_function_identity_arguments(r.oid) || ')';
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.issue_warrant(
    p_target_id UUID,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_officer_id UUID;
    v_case_id UUID;
BEGIN
    v_officer_id := auth.uid();

    -- Check if officer has authority
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = v_officer_id AND authority_level >= 3
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient authority level');
    END IF;

    -- Create court case
    INSERT INTO public.troll_court_cases (
        defendant_id,
        case_type,
        title,
        description,
        status,
        filed_by
    ) VALUES (
        p_target_id,
        'warrant',
        'Arrest Warrant',
        p_reason,
        'pending',
        v_officer_id
    ) RETURNING id INTO v_case_id;

    -- Mark defendant as having active warrant
    UPDATE public.user_profiles
    SET has_active_warrant = true
    WHERE id = p_target_id;

    RETURN jsonb_build_object(
        'success', true,
        'warrant_id', v_case_id,
        'message', 'Warrant issued successfully'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_warrant(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 3. reset_troll_coins - Admin function to reset user coin balances
-- ============================================================================
DROP FUNCTION IF EXISTS public.reset_troll_coins(UUID, BIGINT);

CREATE OR REPLACE FUNCTION public.reset_troll_coins(
    p_user_id UUID,
    p_new_balance BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_balance BIGINT;
BEGIN
    -- Check if caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND is_admin = true
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Admin access required');
    END IF;

    -- Get old balance
    SELECT troll_coins INTO v_old_balance
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF v_old_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User profile not found');
    END IF;

    -- Reset balance
    UPDATE public.user_profiles
    SET troll_coins = p_new_balance,
        updated_at = now()
    WHERE id = p_user_id;

    -- Log the reset
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
    VALUES (
        p_user_id,
        p_new_balance - v_old_balance,
        'admin',
        'admin_reset',
        p_user_id::text,
        jsonb_build_object('admin_id', auth.uid(), 'old_balance', v_old_balance, 'new_balance', p_new_balance),
        'in'
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'old_balance', v_old_balance,
        'new_balance', p_new_balance
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_troll_coins(UUID, BIGINT) TO authenticated;

-- ============================================================================
-- 4. create_atomic_battle_challenge - Atomic battle challenge (wrapper for compatibility)
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_atomic_battle_challenge(UUID, UUID);

CREATE OR REPLACE FUNCTION public.create_atomic_battle_challenge(
    p_challenger_id UUID,
    p_opponent_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_battle_id UUID;
BEGIN
    -- Use the existing create_battle_challenge function
    SELECT public.create_battle_challenge(p_challenger_id, p_opponent_id)
    INTO v_battle_id;
    
    RETURN v_battle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_atomic_battle_challenge(UUID, UUID) TO authenticated;

-- ============================================================================
-- 5. Alias functions for backward compatibility
-- ============================================================================

-- Drop any existing alias and create new one
DO $$
BEGIN
    DROP FUNCTION IF EXISTS public.send_guest_gift(UUID, UUID, UUID, TEXT, INTEGER);
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

COMMENT ON FUNCTION public.send_guest_gift IS 'Sends a gift from a guest (anonymous user) to a broadcaster. Credits sender coins to receiver minus platform fee.';
COMMENT ON FUNCTION public.issue_warrant IS 'Issues an arrest warrant for a defendant by an authorized officer.';
COMMENT ON FUNCTION public.reset_troll_coins IS 'Resets a user troll_coins balance to specified value (admin only).';
COMMENT ON FUNCTION public.create_atomic_battle_challenge IS 'Creates an atomic battle challenge between two streamers (wrapper for create_battle_challenge).';
