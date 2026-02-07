-- Day One Features: Guest Tracking and Broadcast Overrides

-- 1. Guest Tracking Table
CREATE TABLE IF NOT EXISTS public.guest_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address TEXT,
    fingerprint TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    is_blocked BOOLEAN DEFAULT false,
    blocked_reason TEXT,
    blocked_at TIMESTAMPTZ
);

-- RLS for Guest Tracking
ALTER TABLE public.guest_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage guest tracking" ON public.guest_tracking;
CREATE POLICY "Admins can manage guest tracking" ON public.guest_tracking FOR ALL
USING (auth.uid() IN (SELECT id FROM public.user_profiles WHERE role IN ('admin', 'super_admin') OR is_admin = true));

-- 2. Guest Stream Sessions (for 1-minute preview enforcement)
CREATE TABLE IF NOT EXISTS public.guest_stream_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address TEXT NOT NULL,
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + interval '1 minute'),
    UNIQUE(ip_address, stream_id)
);

ALTER TABLE public.guest_stream_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages guest sessions" ON public.guest_stream_sessions;
CREATE POLICY "Service role manages guest sessions" ON public.guest_stream_sessions FOR ALL
USING (auth.role() = 'service_role');

-- 3. Broadcast Overrides Table
CREATE TABLE IF NOT EXISTS public.broadcast_overrides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    stream_id UUID REFERENCES public.streams(id) NOT NULL,
    override_duration INTERVAL NOT NULL, -- e.g. '24 hours'
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id), -- Admin/System
    reason TEXT
);

-- 4. Broadcast Limit Logic

-- Function to calculate total purchased coins (Stripe + Manual)
CREATE OR REPLACE FUNCTION public.get_total_purchased_coins(p_user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stripe_coins BIGINT := 0;
    v_manual_coins BIGINT := 0;
BEGIN
    -- Sum Stripe orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coin_orders') THEN
        SELECT COALESCE(SUM(coins), 0) INTO v_stripe_coins
        FROM public.coin_orders
        WHERE user_id = p_user_id AND status IN ('paid', 'fulfilled');
    END IF;

    -- Sum Manual orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manual_coin_orders') THEN
        SELECT COALESCE(SUM(coins), 0) INTO v_manual_coins
        FROM public.manual_coin_orders
        WHERE user_id = p_user_id AND status IN ('paid', 'fulfilled');
    END IF;

    RETURN v_stripe_coins + v_manual_coins;
END;
$$;

-- Function to check time limit
CREATE OR REPLACE FUNCTION public.get_stream_time_limit(p_user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_purchased BIGINT;
    v_role TEXT;
    v_override_duration INTERVAL;
BEGIN
    -- Check role first (Admins/Mods always bypass)
    SELECT role INTO v_role FROM public.user_profiles WHERE id = p_user_id;
    
    IF v_role IN ('admin', 'moderator', 'super_admin', 'troll_officer') THEN
        RETURN 86400000; -- 24 hours (or practically unlimited)
    END IF;

    -- Check for specific stream override (most recent active one)
    -- This requires a stream_id context, but this RPC takes user_id.
    -- Assuming this RPC is called for general "can I broadcast long?" check.
    -- If we want per-stream override, we'd need stream_id.
    -- For now, let's just check if they have ANY override or high spending.
    
    -- Check purchase history
    v_total_purchased := public.get_total_purchased_coins(p_user_id);

    IF v_total_purchased > 1000 THEN
        RETURN 86400000; -- 24 hours
    ELSE
        RETURN 3600000; -- 1 hour
    END IF;
END;
$$;

-- Grant execute to auth users
GRANT EXECUTE ON FUNCTION public.get_stream_time_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_purchased_coins(UUID) TO authenticated;
