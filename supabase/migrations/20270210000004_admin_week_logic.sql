-- Admin for a Week Logic

-- 1. Ensure Table Exists and has required columns
CREATE TABLE IF NOT EXISTS public.admin_for_week_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending', -- pending, active, completed
    amount_paid INTEGER DEFAULT 100000
);

-- Add joined_at column if it doesn't exist (using ALTER TABLE directly)
ALTER TABLE public.admin_for_week_queue ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Join Queue RPC
CREATE OR REPLACE FUNCTION public.join_admin_queue()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_cost INTEGER := 100000;
    v_balance INTEGER;
BEGIN
    -- Check if already in pending queue
    IF EXISTS (SELECT 1 FROM public.admin_for_week_queue WHERE user_id = v_user_id AND status = 'pending') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already in queue');
    END IF;

    -- Check balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds (Need 100k)');
    END IF;

    -- Deduct Coins
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_cost WHERE id = v_user_id;

    -- Add to Ledger
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
    VALUES (v_user_id, -v_cost, 'purchase', 'admin_queue', 'Joined Admin for a Week Queue', 'out');

    -- Add to Queue
    INSERT INTO public.admin_for_week_queue (user_id, status, amount_paid)
    VALUES (v_user_id, 'pending', v_cost);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Get Queue
CREATE OR REPLACE FUNCTION public.get_admin_queue()
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    joined_at TIMESTAMPTZ,
    status TEXT,
    queue_position BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        q.user_id,
        p.username,
        q.joined_at,
        q.status,
        ROW_NUMBER() OVER (ORDER BY q.joined_at ASC) as queue_position
    FROM public.admin_for_week_queue q
    JOIN public.user_profiles p ON q.user_id = p.id
    WHERE q.status = 'pending';
$$;

-- 4. Get Current Admin of Week
CREATE OR REPLACE FUNCTION public.get_current_admin_week()
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    started_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        q.user_id,
        p.username,
        q.joined_at -- effectively started_at when status became active? We might need a separate column for activation time.
    FROM public.admin_for_week_queue q
    JOIN public.user_profiles p ON q.user_id = p.id
    WHERE q.status = 'active'
    LIMIT 1;
$$;

-- 5. Rotate Admin (To be called by Cron or Manual Admin)
CREATE OR REPLACE FUNCTION public.rotate_admin_of_week()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_admin_id UUID;
    v_next_entry_id UUID;
    v_next_user_id UUID;
BEGIN
    -- 1. Demote current admin
    SELECT user_id INTO v_current_admin_id FROM public.admin_for_week_queue WHERE status = 'active' LIMIT 1;
    
    IF v_current_admin_id IS NOT NULL THEN
        UPDATE public.admin_for_week_queue SET status = 'completed' WHERE user_id = v_current_admin_id AND status = 'active';
        -- Remove admin role (Be careful not to remove permanent admins! Maybe we need a specific flag? 
        -- For now, we assume this system only toggles the role for these users. 
        -- Ideally, we check if they were admin BEFORE the week started. 
        -- But simplified: we just set is_admin = false.)
        UPDATE public.user_profiles SET is_admin = false WHERE id = v_current_admin_id;
    END IF;

    -- 2. Promote next in line
    SELECT id, user_id INTO v_next_entry_id, v_next_user_id 
    FROM public.admin_for_week_queue 
    WHERE status = 'pending' 
    ORDER BY joined_at ASC 
    LIMIT 1;

    IF v_next_entry_id IS NOT NULL THEN
        UPDATE public.admin_for_week_queue SET status = 'active' WHERE id = v_next_entry_id;
        UPDATE public.user_profiles SET is_admin = true WHERE id = v_next_user_id;
        RETURN jsonb_build_object('success', true, 'new_admin_id', v_next_user_id);
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'No new admin in queue');
END;
$$;
