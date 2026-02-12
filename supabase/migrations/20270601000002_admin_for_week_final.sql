-- Migration: Admin For A Week Final Implementation
-- Description: Implements the TEMP_CITY_ADMIN role, logging, and queue logic with strict safety boundaries.

-- 1. Ensure admin_actions_log exists (Required by prompt)
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    target_user_id UUID REFERENCES public.user_profiles(id),
    action_type TEXT NOT NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on log
ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view logs" ON public.admin_actions_log;
CREATE POLICY "Admins view logs" ON public.admin_actions_log 
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'temp_city_admin') OR is_admin = true))
);

DROP POLICY IF EXISTS "System insert logs" ON public.admin_actions_log;
CREATE POLICY "System insert logs" ON public.admin_actions_log 
FOR INSERT WITH CHECK (true);

-- 2. Add TEMP_CITY_ADMIN to system_roles (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_roles') THEN
        INSERT INTO public.system_roles (name, hierarchy_rank, is_staff, is_admin, description)
        VALUES ('temp_city_admin', 180, true, false, 'Temporary Admin for a Week - Limited Powers')
        ON CONFLICT (name) DO NOTHING;
    END IF;
END $$;

-- 3. Add columns to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_admin_term_end TIMESTAMPTZ;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS admin_coins_balance INTEGER DEFAULT 0;

-- 4. Update purchase logic
CREATE OR REPLACE FUNCTION public.purchase_admin_for_week()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_cost INTEGER := 200000;
    v_balance INTEGER;
    v_last_term TIMESTAMPTZ;
BEGIN
    -- Check cooldown (14 days)
    SELECT last_admin_term_end, troll_coins INTO v_last_term, v_balance 
    FROM public.user_profiles WHERE id = v_user_id;

    IF v_last_term IS NOT NULL AND v_last_term > NOW() - INTERVAL '14 days' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cooldown active. Cannot repurchase yet.');
    END IF;

    -- Check balance
    IF v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
    END IF;

    -- Check queue
    IF EXISTS (SELECT 1 FROM public.admin_for_week_queue WHERE user_id = v_user_id AND status IN ('queued', 'active')) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already in queue');
    END IF;

    -- Deduct coins
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_cost WHERE id = v_user_id;
    
    -- Ledger
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
    VALUES (v_user_id, -v_cost, 'purchase', 'store', 'Purchase Admin For A Week', 'out');

    -- Add to queue
    INSERT INTO public.admin_for_week_queue (user_id, status)
    VALUES (v_user_id, 'queued');

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Update Queue Processing (The Core Logic)
CREATE OR REPLACE FUNCTION public.process_admin_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_admin RECORD;
    v_next_admin RECORD;
BEGIN
    -- 1. Check current active admin
    SELECT * INTO v_current_admin 
    FROM public.admin_for_week_queue 
    WHERE status = 'active' 
    ORDER BY started_at DESC 
    LIMIT 1;

    IF v_current_admin.id IS NOT NULL THEN
        -- Check expiration
        IF v_current_admin.ended_at < NOW() THEN
            -- Expire
            UPDATE public.admin_for_week_queue 
            SET status = 'completed' 
            WHERE id = v_current_admin.id;
            
            -- Revoke Role
            UPDATE public.user_profiles 
            SET role = 'citizen', -- reverting to basic citizen
                admin_coins_balance = 0, -- wipe admin coins
                last_admin_term_end = NOW() -- set cooldown start
            WHERE id = v_current_admin.user_id;
            
            -- Remove from user_role_grants if used
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_role_grants') THEN
                DELETE FROM public.user_role_grants 
                WHERE user_id = v_current_admin.user_id 
                AND role_id = (SELECT id FROM public.system_roles WHERE name = 'temp_city_admin');
            END IF;

            -- Log
            INSERT INTO public.admin_actions_log (admin_user_id, action_type, reason)
            VALUES (v_current_admin.user_id, 'term_expired', 'Admin term ended automatically');
        ELSE
            RETURN; -- Still active
        END IF;
    END IF;

    -- 2. Promote next
    SELECT * INTO v_next_admin 
    FROM public.admin_for_week_queue 
    WHERE status = 'queued' 
    ORDER BY created_at ASC 
    LIMIT 1;

    IF v_next_admin.id IS NOT NULL THEN
        -- Activate
        UPDATE public.admin_for_week_queue 
        SET status = 'active', 
            started_at = NOW(), 
            ended_at = NOW() + INTERVAL '7 days' 
        WHERE id = v_next_admin.id;

        -- Grant Role
        UPDATE public.user_profiles 
        SET role = 'temp_city_admin' -- Special role name
        WHERE id = v_next_admin.user_id;

        -- Grant via system_roles if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_role_grants') THEN
            INSERT INTO public.user_role_grants (user_id, role_id, expires_at)
            SELECT v_next_admin.user_id, id, NOW() + INTERVAL '7 days'
            FROM public.system_roles WHERE name = 'temp_city_admin'
            ON CONFLICT DO NOTHING;
        END IF;

        -- Log
        INSERT INTO public.admin_actions_log (admin_user_id, action_type, reason)
        VALUES (v_next_admin.user_id, 'term_started', 'Admin term started');
    END IF;
END;
$$;

-- 6. Helper for Logging Admin Actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
    p_action_type TEXT,
    p_target_user_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.admin_actions_log (admin_user_id, target_user_id, action_type, reason, metadata)
    VALUES (auth.uid(), p_target_user_id, p_action_type, p_reason, p_metadata);
END;
$$;

-- 7. Update is_staff to include temp_city_admin
-- IMPORTANT: We must DROP CASCADE to remove dependent policies, then recreate them.
DROP FUNCTION IF EXISTS public.is_staff(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.is_staff(p_user_id UUID DEFAULT public.current_user_id())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN RETURN false; END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND (
            role IN ('admin', 'officer', 'lead_officer', 'secretary', 'pastor', 'temp_city_admin')
            OR is_admin = true 
            OR is_lead_officer = true
            OR is_troll_officer = true
        )
        AND (banned_at IS NULL)
        AND (suspended_until IS NULL OR suspended_until < NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Recreate policies dropped by CASCADE
-- 1. Troll Wall Posts
CREATE POLICY "Staff remove content" ON public.troll_wall_posts
FOR DELETE
USING (public.is_staff(auth.uid()));

-- 2. Troll Post Reactions
CREATE POLICY "Staff remove reactions" ON public.troll_post_reactions
FOR DELETE
USING (public.is_staff(auth.uid()));

-- 3. Court Cases
CREATE POLICY "Users read own court cases" ON public.court_cases
FOR SELECT
USING (auth.uid() = defendant_id OR auth.uid() = plaintiff_id OR public.is_staff(auth.uid()));

-- 4. Officer Shifts
CREATE POLICY "Officers clock in/out" ON public.officer_shifts
FOR ALL
USING (public.is_staff(auth.uid()));

-- 5. Support Tickets
CREATE POLICY "Users read own tickets" ON public.support_tickets
FOR SELECT
USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE POLICY "Staff manage tickets" ON public.support_tickets
FOR UPDATE
USING (public.is_staff(auth.uid()));

-- 8. Emergency Revoke RPC
CREATE OR REPLACE FUNCTION public.emergency_revoke_admin(p_target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only super admin
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Revoke
    UPDATE public.user_profiles 
    SET role = 'citizen', 
        admin_coins_balance = 0 
    WHERE id = p_target_user_id;

    UPDATE public.admin_for_week_queue 
    SET status = 'removed', ended_at = NOW() 
    WHERE user_id = p_target_user_id AND status = 'active';

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_role_grants') THEN
        UPDATE public.user_role_grants
        SET revoked_at = NOW(), revocation_reason = 'Emergency Revoke'
        WHERE user_id = p_target_user_id AND role_id = (SELECT id FROM public.system_roles WHERE name = 'temp_city_admin');
    END IF;

    -- Log
    INSERT INTO public.admin_actions_log (admin_user_id, target_user_id, action_type, reason)
    VALUES (auth.uid(), p_target_user_id, 'emergency_revoke', 'Super Admin revoked privileges');
END;
$$;
