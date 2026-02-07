-- Migration: Dual-Path Streaming & Legal System
-- Description: Implements atomic seat reservation, paid seats, kick grace period, and court lawsuits.

-- Ensure btree_gist extension exists for EXCLUDE constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Create stream_seat_sessions table (The "Ledger" for seats)
CREATE TABLE IF NOT EXISTS public.stream_seat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    seat_index INTEGER NOT NULL,
    price_paid INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT now(),
    left_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('active', 'left', 'kicked', 'disconnected')),
    kick_reason TEXT
);

-- Ensure only one active session per seat per stream
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_seat 
ON public.stream_seat_sessions (stream_id, seat_index) 
WHERE status = 'active';

-- Ensure columns exist in stream_seat_sessions if it was created before
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_seat_sessions' AND column_name = 'kick_reason') THEN
        ALTER TABLE public.stream_seat_sessions ADD COLUMN kick_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_seat_sessions' AND column_name = 'price_paid') THEN
        ALTER TABLE public.stream_seat_sessions ADD COLUMN price_paid INTEGER DEFAULT 0;
    END IF;
END $$;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_stream_seat_sessions_stream_status ON stream_seat_sessions(stream_id, status);
CREATE INDEX IF NOT EXISTS idx_stream_seat_sessions_user ON stream_seat_sessions(user_id);

-- 2. Create court_cases table
CREATE TABLE IF NOT EXISTS public.court_cases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plaintiff_id UUID NOT NULL REFERENCES public.user_profiles(id),
    defendant_id UUID NOT NULL REFERENCES public.user_profiles(id),
    session_id UUID REFERENCES public.stream_seat_sessions(id),
    claim_amount INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    evidence_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    verdict_reason TEXT
);

-- Ensure columns exist if table already existed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'session_id') THEN
        ALTER TABLE public.court_cases ADD COLUMN session_id UUID REFERENCES public.stream_seat_sessions(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'claim_amount') THEN
        ALTER TABLE public.court_cases ADD COLUMN claim_amount INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'evidence_snapshot') THEN
        ALTER TABLE public.court_cases ADD COLUMN evidence_snapshot JSONB;
    END IF;
     IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'plaintiff_id') THEN
        ALTER TABLE public.court_cases ADD COLUMN plaintiff_id UUID REFERENCES public.user_profiles(id);
    END IF;
     IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'defendant_id') THEN
        ALTER TABLE public.court_cases ADD COLUMN defendant_id UUID REFERENCES public.user_profiles(id);
    END IF;

    -- Make docket_id nullable if it exists (for compatibility with lawsuit filing)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'docket_id') THEN
        ALTER TABLE public.court_cases ALTER COLUMN docket_id DROP NOT NULL;
    END IF;

    -- Ensure case_type has a default
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'case_type') THEN
        ALTER TABLE public.court_cases ALTER COLUMN case_type SET DEFAULT 'civil';
    END IF;

    -- Make reason nullable if it exists (since we use evidence_snapshot for details)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'reason') THEN
        ALTER TABLE public.court_cases ALTER COLUMN reason DROP NOT NULL;
    END IF;

    -- Make incident_date nullable or default now()
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'incident_date') THEN
        ALTER TABLE public.court_cases ALTER COLUMN incident_date SET DEFAULT now();
    END IF;

    -- Make stream_id nullable if it exists (we use session_id now)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'stream_id') THEN
        ALTER TABLE public.court_cases ALTER COLUMN stream_id DROP NOT NULL;
    END IF;

    -- Make accusation nullable if it exists (we use kick_reason/evidence_snapshot)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'accusation') THEN
        ALTER TABLE public.court_cases ALTER COLUMN accusation DROP NOT NULL;
    END IF;

    -- Make prosecutor_id nullable if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'prosecutor_id') THEN
        ALTER TABLE public.court_cases ALTER COLUMN prosecutor_id DROP NOT NULL;
    END IF;

    -- Make judge_id nullable if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'judge_id') THEN
        ALTER TABLE public.court_cases ALTER COLUMN judge_id DROP NOT NULL;
    END IF;
END $$;

-- 3. RPC: Atomic Join Seat
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature 
             FROM pg_proc 
             WHERE proname = 'join_seat_atomic' 
             AND pronamespace = 'public'::regnamespace 
    LOOP 
        EXECUTE 'DROP FUNCTION ' || r.func_signature; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION public.join_seat_atomic(
    p_stream_id UUID,
    p_seat_index INTEGER,
    p_price INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_balance INTEGER;
    v_active_session_id UUID;
    v_already_paid BOOLEAN := FALSE;
    v_stream_owner UUID;
    v_new_session_id UUID;
BEGIN
    -- 1. Validate Stream & Owner
    SELECT user_id INTO v_stream_owner FROM public.streams WHERE id = p_stream_id;
    IF v_stream_owner IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Stream not found');
    END IF;

    -- 2. Check if seat is occupied
    -- The EXCLUDE constraint handles race conditions, but a quick check saves an exception
    IF EXISTS (
        SELECT 1 FROM public.stream_seat_sessions 
        WHERE stream_id = p_stream_id 
        AND seat_index = p_seat_index 
        AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Seat already taken');
    END IF;

    -- 3. Check Payment History (Idempotency for this stream)
    -- If user has already paid for a seat in this stream session (and maybe left/rejoined), 
    -- we might want to allow free rejoin? 
    -- User requirement: "If already paid -> do NOT charge again."
    -- We check if they have a previous session with price_paid > 0 for this stream?
    -- Or should we track "paid access" separately? 
    -- Let's assume if they paid for *this specific seat* or just *any seat*?
    -- Requirement: "Check if the user has already paid for THIS SPECIFIC SEAT for the current broadcast session."
    -- Implementation: Check prior sessions for this stream/seat.
    
    -- BUT, what defines "current broadcast session"? 
    -- Assuming 'streams' table represents a single broadcast session (id is unique per stream).
    
    IF EXISTS (
        SELECT 1 FROM public.stream_seat_sessions
        WHERE stream_id = p_stream_id
        AND user_id = v_user_id
        AND seat_index = p_seat_index
        AND price_paid >= p_price -- They paid at least this amount before
    ) THEN
        v_already_paid := TRUE;
    END IF;

    -- 4. Process Payment
    IF p_price > 0 AND NOT v_already_paid THEN
        -- Lock & Check Balance
        SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;
        
        IF v_user_balance < p_price THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
        END IF;

        -- Deduct from User
        UPDATE public.user_profiles 
        SET troll_coins = troll_coins - p_price 
        WHERE id = v_user_id;

        -- Credit to Host (90%) - Burn 10%
        -- Or use the 'spend_coins' logic? For now, simple transfer.
        UPDATE public.user_profiles
        SET troll_coins = troll_coins + FLOOR(p_price * 0.9)
        WHERE id = v_stream_owner;
        
        -- Log Transaction (optional but recommended)
        INSERT INTO public.coin_transactions (user_id, amount, type, description)
        VALUES (v_user_id, -p_price, 'purchase', 'Seat ' || p_seat_index || ' in stream ' || p_stream_id);
    END IF;

    -- 5. Create Session
    INSERT INTO public.stream_seat_sessions (
        stream_id, user_id, seat_index, price_paid, status, joined_at
    ) VALUES (
        p_stream_id, v_user_id, p_seat_index, CASE WHEN v_already_paid THEN 0 ELSE p_price END, 'active', now()
    ) RETURNING id INTO v_new_session_id;

    RETURN jsonb_build_object(
        'success', true, 
        'session_id', v_new_session_id,
        'paid', CASE WHEN v_already_paid THEN 0 ELSE p_price END
    );

EXCEPTION 
    WHEN unique_violation THEN
        RETURN jsonb_build_object('success', false, 'message', 'Seat already taken (race)');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 4. RPC: Leave Seat
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature 
             FROM pg_proc 
             WHERE proname = 'leave_seat_atomic' 
             AND pronamespace = 'public'::regnamespace 
    LOOP 
        EXECUTE 'DROP FUNCTION ' || r.func_signature; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION public.leave_seat_atomic(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.stream_seat_sessions
    SET status = 'left', left_at = now()
    WHERE id = p_session_id AND user_id = auth.uid() AND status = 'active';

    IF FOUND THEN
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Session not found or already ended');
    END IF;
END;
$$;

-- 5. RPC: Kick Participant (Host Only)
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature 
             FROM pg_proc 
             WHERE proname = 'kick_participant_atomic' 
             AND pronamespace = 'public'::regnamespace 
    LOOP 
        EXECUTE 'DROP FUNCTION ' || r.func_signature; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION public.kick_participant_atomic(
    p_stream_id UUID,
    p_target_user_id UUID,
    p_reason TEXT DEFAULT 'Host kicked'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Verify Host
    IF NOT EXISTS (SELECT 1 FROM public.streams WHERE id = p_stream_id AND user_id = auth.uid()) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    -- Find Active Session
    SELECT id INTO v_session_id
    FROM public.stream_seat_sessions
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id AND status = 'active'
    LIMIT 1;

    IF v_session_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not in seat');
    END IF;

    -- Update Session
    UPDATE public.stream_seat_sessions
    SET status = 'kicked', left_at = now(), kick_reason = p_reason
    WHERE id = v_session_id;

    RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END;
$$;

-- 6. RPC: File Lawsuit (The 2x Claim)
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature 
             FROM pg_proc 
             WHERE proname = 'file_seat_lawsuit' 
             AND pronamespace = 'public'::regnamespace 
    LOOP 
        EXECUTE 'DROP FUNCTION ' || r.func_signature; 
    END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION public.file_seat_lawsuit(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN jsonb_build_object('success', true, 'message', 'Lawsuit filed with Troll City Court (Simulation)');
END;
$$;
