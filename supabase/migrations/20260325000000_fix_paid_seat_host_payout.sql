-- Fix paid seat joins so the broadcaster is credited when a viewer buys a seat.
-- Also return the updated balances so the client can refresh immediately.

CREATE OR REPLACE FUNCTION public.join_seat_atomic(
    p_stream_id UUID,
    p_seat_index INTEGER,
    p_price INTEGER,
    p_user_id UUID DEFAULT NULL,
    p_guest_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_user_balance BIGINT;
    v_effective_price INTEGER := COALESCE(p_price, 0);
    v_has_paid BOOLEAN := FALSE;
    v_are_seats_locked BOOLEAN := FALSE;
    v_host_user_id UUID;
    v_sender_new_balance BIGINT;
    v_host_new_balance BIGINT;
BEGIN
    SELECT user_id, COALESCE(are_seats_locked, false)
    INTO v_host_user_id, v_are_seats_locked
    FROM public.streams
    WHERE id = p_stream_id;

    IF v_host_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Stream not found');
    END IF;

    IF v_are_seats_locked THEN
        RETURN jsonb_build_object('success', false, 'message', 'Seats are currently locked');
    END IF;

    IF p_user_id IS NULL AND p_guest_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User ID or Guest ID required');
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.stream_seat_sessions
        WHERE stream_id = p_stream_id
          AND seat_index = p_seat_index
          AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Seat is occupied');
    END IF;

    IF p_user_id IS NOT NULL AND v_effective_price > 0 THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.stream_seat_sessions
            WHERE stream_id = p_stream_id
              AND user_id = p_user_id
              AND COALESCE(price_paid, 0) > 0
        ) INTO v_has_paid;
    ELSIF p_guest_id IS NOT NULL AND v_effective_price > 0 THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.stream_seat_sessions
            WHERE stream_id = p_stream_id
              AND guest_id = p_guest_id
              AND COALESCE(price_paid, 0) > 0
        ) INTO v_has_paid;
    END IF;

    IF v_has_paid THEN
        v_effective_price := 0;
    END IF;

    IF p_user_id IS NOT NULL AND v_effective_price > 0 THEN
        SELECT troll_coins
        INTO v_user_balance
        FROM public.user_profiles
        WHERE id = p_user_id
        FOR UPDATE;

        IF COALESCE(v_user_balance, 0) < v_effective_price THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
        END IF;

        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_effective_price
        WHERE id = p_user_id
        RETURNING troll_coins INTO v_sender_new_balance;

        UPDATE public.user_profiles
        SET troll_coins = COALESCE(troll_coins, 0) + v_effective_price
        WHERE id = v_host_user_id
        RETURNING troll_coins INTO v_host_new_balance;
    ELSIF v_effective_price > 0 THEN
        -- Guests should never be allowed to occupy a paid seat without an authenticated payer.
        RETURN jsonb_build_object('success', false, 'message', 'Sign in required for paid seats');
    END IF;

    INSERT INTO public.stream_seat_sessions (
        stream_id,
        seat_index,
        user_id,
        guest_id,
        price_paid,
        status,
        joined_at
    )
    VALUES (
        p_stream_id,
        p_seat_index,
        p_user_id,
        p_guest_id,
        v_effective_price,
        'active',
        NOW()
    )
    RETURNING id INTO v_session_id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session_id,
        'price_paid', v_effective_price,
        'host_user_id', v_host_user_id,
        'sender_new_balance', v_sender_new_balance,
        'host_new_balance', v_host_new_balance
    );
END;
$$;
