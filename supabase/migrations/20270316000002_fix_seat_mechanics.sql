-- Ensure stream_seat_sessions table exists (if not already)
CREATE TABLE IF NOT EXISTS public.stream_seat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    seat_index INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'kicked')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    price_paid INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.stream_seat_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
-- EVERYONE must be able to see active sessions to render the grid
DROP POLICY IF EXISTS "Anyone can view active seat sessions" ON public.stream_seat_sessions;
CREATE POLICY "Anyone can view active seat sessions" 
ON public.stream_seat_sessions FOR SELECT 
USING (true);

-- Users can insert their own session (via RPC usually, but good to have)
DROP POLICY IF EXISTS "Users can insert their own session" ON public.stream_seat_sessions;
CREATE POLICY "Users can insert their own session" 
ON public.stream_seat_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own session (to leave)
DROP POLICY IF EXISTS "Users can update their own session" ON public.stream_seat_sessions;
CREATE POLICY "Users can update their own session" 
ON public.stream_seat_sessions FOR UPDATE
USING (auth.uid() = user_id);

-- RPC: Join Seat Atomic
DROP FUNCTION IF EXISTS public.join_seat_atomic(UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.join_seat_atomic(p_stream_id UUID, p_seat_index INTEGER, p_price INTEGER)
RETURNS TABLE (success BOOLEAN, message TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_is_locked BOOLEAN;
    v_seat_price INTEGER;
    v_exists BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if stream exists and get settings
    SELECT are_seats_locked, seat_price INTO v_is_locked, v_seat_price
    FROM public.streams WHERE id = p_stream_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Stream not found'::TEXT;
        RETURN;
    END IF;
    
    IF v_is_locked THEN
        RETURN QUERY SELECT false, 'Seats are currently locked'::TEXT;
        RETURN;
    END IF;

    -- Check if seat is occupied
    SELECT EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE stream_id = p_stream_id 
        AND seat_index = p_seat_index 
        AND status = 'active'
    ) INTO v_exists;
    
    IF v_exists THEN
        RETURN QUERY SELECT false, 'Seat is already occupied'::TEXT;
        RETURN;
    END IF;

    -- Check if user is already in a seat
    SELECT EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE stream_id = p_stream_id 
        AND user_id = v_user_id 
        AND status = 'active'
    ) INTO v_exists;
    
    IF v_exists THEN
        RETURN QUERY SELECT false, 'You are already in a seat'::TEXT;
        RETURN;
    END IF;

    -- Handle Payment if needed
    IF v_seat_price > 0 THEN
        IF (SELECT troll_coins FROM public.user_profiles WHERE user_id = v_user_id) < v_seat_price THEN
            RETURN QUERY SELECT false, 'Insufficient coins'::TEXT;
            RETURN;
        END IF;
        
        -- Deduct coins
        UPDATE public.user_profiles 
        SET troll_coins = troll_coins - v_seat_price 
        WHERE user_id = v_user_id;
        
        -- Pay Host (optional, maybe partial?) - For now just burn/transfer logic can be added here
        -- Update stream owner balance?
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + v_seat_price
        WHERE user_id = (SELECT user_id FROM public.streams WHERE id = p_stream_id);
    END IF;

    -- Insert Session
    INSERT INTO public.stream_seat_sessions (stream_id, user_id, seat_index, status, price_paid)
    VALUES (p_stream_id, v_user_id, p_seat_index, 'active', v_seat_price);

    RETURN QUERY SELECT true, 'Joined seat successfully'::TEXT;
END;
$$;

-- RPC: Leave Seat Atomic
DROP FUNCTION IF EXISTS public.leave_seat_atomic(UUID);
CREATE OR REPLACE FUNCTION public.leave_seat_atomic(p_session_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Verify ownership of session
    IF NOT EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE id = p_session_id AND user_id = v_user_id
    ) THEN
        RETURN QUERY SELECT false, 'Session not found or not yours'::TEXT;
        RETURN;
    END IF;

    -- Update status
    UPDATE public.stream_seat_sessions 
    SET status = 'left', left_at = NOW() 
    WHERE id = p_session_id;

    RETURN QUERY SELECT true, 'Left seat successfully'::TEXT;
END;
$$;

-- RPC: Kick Participant Atomic
DROP FUNCTION IF EXISTS public.kick_participant_atomic(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.kick_participant_atomic(p_stream_id UUID, p_target_user_id UUID, p_reason TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if requester is host or admin
    SELECT EXISTS (
        SELECT 1 FROM public.streams 
        WHERE id = p_stream_id AND user_id = v_user_id
    ) INTO v_is_admin;
    
    IF NOT v_is_admin THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = v_user_id AND role IN ('admin', 'moderator')
        ) INTO v_is_admin;
    END IF;
    
    IF NOT v_is_admin THEN
        RETURN QUERY SELECT false, 'Permission denied'::TEXT;
        RETURN;
    END IF;

    -- End active sessions for this user on this stream
    UPDATE public.stream_seat_sessions 
    SET status = 'kicked', left_at = NOW() 
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id AND status = 'active';

    -- Add to ban list (kick = temp ban usually, or just kick)
    -- We won't ban permanently here, just kick from seat. 
    -- If we want to ban from stream, use stream_bans table.
    
    RETURN QUERY SELECT true, 'User kicked from seat'::TEXT;
END;
$$;
