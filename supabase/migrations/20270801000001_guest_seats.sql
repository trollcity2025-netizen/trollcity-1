-- Migration: Support Guest Seats
-- Description: Allows guests (TC-XXXX) to join seats by making user_id nullable and adding guest_id.

-- 1. Alter Table
ALTER TABLE public.stream_seat_sessions 
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.stream_seat_sessions 
ADD COLUMN IF NOT EXISTS guest_id TEXT;

-- 2. Update join_seat_atomic
-- Drop old version to avoid ambiguity and ensure clean slate
DROP FUNCTION IF EXISTS public.join_seat_atomic(UUID, INTEGER, INTEGER, UUID);
DROP FUNCTION IF EXISTS public.join_seat_atomic(UUID, INTEGER, INTEGER, UUID, TEXT);

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
BEGIN
    -- Validate inputs
    IF p_user_id IS NULL AND p_guest_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User ID or Guest ID required');
    END IF;

    -- Check if seat is occupied
    IF EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE stream_id = p_stream_id 
        AND seat_index = p_seat_index 
        AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Seat is occupied');
    END IF;

    -- If user/guest already paid in this stream, skip charging again
    IF p_user_id IS NOT NULL AND v_effective_price > 0 THEN
        SELECT EXISTS (
            SELECT 1 FROM public.stream_seat_sessions
            WHERE stream_id = p_stream_id
              AND user_id = p_user_id
              AND COALESCE(price_paid, 0) > 0
        ) INTO v_has_paid;
    ELSIF p_guest_id IS NOT NULL AND v_effective_price > 0 THEN
        SELECT EXISTS (
            SELECT 1 FROM public.stream_seat_sessions
            WHERE stream_id = p_stream_id
              AND guest_id = p_guest_id
              AND COALESCE(price_paid, 0) > 0
        ) INTO v_has_paid;
    END IF;

    IF v_has_paid THEN
        v_effective_price := 0;
    END IF;

    -- If Registered User -> Check Balance for Price
    IF p_user_id IS NOT NULL AND v_effective_price > 0 THEN
        SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = p_user_id;
        IF COALESCE(v_user_balance, 0) < v_effective_price THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
        END IF;
        
        -- Deduct coins (Simplified: No cuts for MVP/Guest logic adjustment)
        -- In real implementation, call spend_coins or similar
        UPDATE public.user_profiles 
        SET troll_coins = troll_coins - v_effective_price 
        WHERE id = p_user_id;
    END IF;

    -- Insert Session
    INSERT INTO public.stream_seat_sessions (stream_id, seat_index, user_id, guest_id, price_paid, status, joined_at)
    VALUES (p_stream_id, p_seat_index, p_user_id, p_guest_id, v_effective_price, 'active', NOW())
    RETURNING id INTO v_session_id;

    RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END;
$$;

-- 3. Update get_stream_seats
-- Drop with CASCADE to ensure we can change return type even if there are dependencies
DROP FUNCTION IF EXISTS public.get_stream_seats(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_stream_seats(p_stream_id UUID)
RETURNS TABLE (
    id UUID,
    seat_index INTEGER,
    user_id UUID,
    guest_id TEXT,
    status TEXT,
    joined_at TIMESTAMPTZ,
    username TEXT,
    avatar_url TEXT,
    is_gold BOOLEAN,
    role TEXT,
    troll_coins BIGINT,
    rgb_username_expires_at TIMESTAMPTZ,
    glowing_username_color TEXT,
    troll_role TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id::UUID,
        s.seat_index::INTEGER,
        s.user_id::UUID,
        s.guest_id::TEXT,
        s.status::TEXT,
        s.joined_at::TIMESTAMPTZ,
        (CASE 
            WHEN s.user_id IS NOT NULL THEN COALESCE(u.username, 'Unknown')
            ELSE COALESCE(s.guest_id, 'Guest')
        END)::TEXT as username,
        (CASE 
            WHEN s.user_id IS NOT NULL THEN COALESCE(u.avatar_url, 'https://ui-avatars.com/api/?name=' || COALESCE(u.username, 'User') || '&background=random')
            ELSE 'https://ui-avatars.com/api/?name=' || COALESCE(s.guest_id, 'Guest') || '&background=random'
        END)::TEXT as avatar_url,
        COALESCE(u.is_gold, false)::BOOLEAN as is_gold,
        COALESCE(u.role, 'guest')::TEXT as role,
        COALESCE(u.troll_coins, 0)::BIGINT as troll_coins,
        u.rgb_username_expires_at::TIMESTAMPTZ,
        u.glowing_username_color::TEXT,
        u.troll_role::TEXT,
        u.created_at::TIMESTAMPTZ
    FROM public.stream_seat_sessions s
    LEFT JOIN public.user_profiles u ON s.user_id = u.id
    WHERE s.stream_id = p_stream_id
    AND s.status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stream_seats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stream_seats(UUID) TO anon;
