-- Migration: 20270320000001_fix_rls_and_day_one.sql
-- Description: Secures new tables and refines RLS for Day-One features

BEGIN;

-- ============================================================================
-- 1. Guest Tracking Security
-- ============================================================================
ALTER TABLE public.guest_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_stream_sessions ENABLE ROW LEVEL SECURITY;

-- We rely on implicit deny-all for anon/authenticated.
-- Only Service Role (Edge Functions) can access these tables.

-- ============================================================================
-- 2. Broadcast Overrides Security
-- ============================================================================
ALTER TABLE public.broadcast_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own overrides" ON public.broadcast_overrides;
CREATE POLICY "Users view own overrides" ON public.broadcast_overrides
    FOR SELECT USING (auth.uid() = user_id);
    
DROP POLICY IF EXISTS "Admins manage overrides" ON public.broadcast_overrides;
CREATE POLICY "Admins manage overrides" ON public.broadcast_overrides
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- ============================================================================
-- 3. Manual Coin Orders Security
-- ============================================================================
ALTER TABLE public.manual_coin_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own manual orders" ON public.manual_coin_orders;
CREATE POLICY "Users view own manual orders" ON public.manual_coin_orders
    FOR SELECT USING (auth.uid() = user_id);
    
DROP POLICY IF EXISTS "Admins manage manual orders" ON public.manual_coin_orders;
CREATE POLICY "Admins manage manual orders" ON public.manual_coin_orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- ============================================================================
-- 4. Cleanup & Harden Streams/Seats
-- ============================================================================
-- Ensure streams are publicly viewable (essential for guest viewing)
DROP POLICY IF EXISTS "Public read streams" ON public.streams;
CREATE POLICY "Public read streams" ON public.streams FOR SELECT USING (true);

-- Cleanup redundant seat policy if it exists
DROP POLICY IF EXISTS "Users view own seat session" ON public.stream_seat_sessions;

-- ============================================================================
-- 5. Fix Permission/Role Checks
-- ============================================================================
-- Grant permissions on new tables to service_role (implicit, but ensuring no weird grants)
GRANT ALL ON public.guest_tracking TO service_role;
GRANT ALL ON public.guest_stream_sessions TO service_role;
GRANT ALL ON public.broadcast_overrides TO service_role;
GRANT ALL ON public.manual_coin_orders TO service_role;

COMMIT;
