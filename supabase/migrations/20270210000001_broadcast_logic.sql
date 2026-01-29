-- Fix0: Broadcast Level System Logic

-- 1. Ensure streams table has the tracking column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'last_level_update_at') THEN
        ALTER TABLE public.streams ADD COLUMN last_level_update_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 2. Function to calculate current level with decay (Read-only helper)
CREATE OR REPLACE FUNCTION public.get_broadcast_level(p_stream_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stored_level INTEGER;
    v_last_update TIMESTAMPTZ;
    v_minutes_diff INTEGER;
    v_decay_amount INTEGER;
BEGIN
    SELECT broadcast_level_percent, last_level_update_at
    INTO v_stored_level, v_last_update
    FROM public.streams
    WHERE id = p_stream_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- If null, assume 0
    IF v_stored_level IS NULL THEN 
        RETURN 0; 
    END IF;

    IF v_last_update IS NULL THEN
        RETURN v_stored_level; -- Should not happen with default, but safe fallback
    END IF;

    -- Calculate decay: -1% every 5 minutes
    v_minutes_diff := EXTRACT(EPOCH FROM (NOW() - v_last_update)) / 60;
    v_decay_amount := FLOOR(v_minutes_diff / 5); -- 1 per 5 mins

    RETURN GREATEST(0, v_stored_level - v_decay_amount);
END;
$$;

-- 3. Function to boost level (Writes to DB)
-- This function first applies pending decay, then adds the boost, then saves.
CREATE OR REPLACE FUNCTION public.boost_broadcast_level(
    p_stream_id UUID, 
    p_boost_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_level INTEGER;
    v_new_level INTEGER;
    v_last_update TIMESTAMPTZ;
    v_minutes_diff INTEGER;
    v_decay_amount INTEGER;
BEGIN
    -- Lock the row to prevent race conditions
    SELECT broadcast_level_percent, last_level_update_at
    INTO v_current_level, v_last_update
    FROM public.streams
    WHERE id = p_stream_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stream not found');
    END IF;

    IF v_current_level IS NULL THEN v_current_level := 0; END IF;
    IF v_last_update IS NULL THEN v_last_update := NOW(); END IF;

    -- Apply pending decay first
    v_minutes_diff := EXTRACT(EPOCH FROM (NOW() - v_last_update)) / 60;
    v_decay_amount := FLOOR(v_minutes_diff / 5);
    v_current_level := GREATEST(0, v_current_level - v_decay_amount);

    -- Apply boost
    v_new_level := LEAST(100, v_current_level + p_boost_amount);

    -- Update table
    UPDATE public.streams
    SET broadcast_level_percent = v_new_level,
        last_level_update_at = NOW()
    WHERE id = p_stream_id;

    RETURN jsonb_build_object('success', true, 'new_level', v_new_level);
END;
$$;

-- 4. Sponsor Item RPC
CREATE OR REPLACE FUNCTION public.sponsor_broadcast_item(
    p_stream_id UUID,
    p_item_id TEXT,
    p_recipient_id UUID DEFAULT NULL -- Optional, for future use
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cost INTEGER;
    v_boost_amount INTEGER;
    v_user_id UUID := auth.uid();
    v_user_balance INTEGER;
    v_item_name TEXT;
BEGIN
    -- Define items config (Hardcoded for now as per UI)
    -- Pizza: 50 coins -> +5%
    -- Drink: 20 coins -> +2%
    -- VIP Badge: 1000 coins -> +100%
    CASE p_item_id
        WHEN 'pizza' THEN
            v_cost := 50;
            v_boost_amount := 5;
            v_item_name := 'Pizza';
        WHEN 'drink' THEN
            v_cost := 20;
            v_boost_amount := 2;
            v_item_name := 'Drink';
        WHEN 'vip_badge' THEN
            v_cost := 1000;
            v_boost_amount := 100;
            v_item_name := 'VIP Badge';
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'Invalid item');
    END CASE;

    -- Check balance
    SELECT troll_coins INTO v_user_balance
    FROM public.user_profiles
    WHERE id = v_user_id;

    IF v_user_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    -- Deduct coins
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_cost
    WHERE id = v_user_id;

    -- Record transaction (using existing ledger if available, or simple log)
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
    VALUES (v_user_id, -v_cost, 'sponsor', 'broadcast', 'sponsor_broadcast:' || v_item_name, 'out');

    -- Boost level
    PERFORM public.boost_broadcast_level(p_stream_id, v_boost_amount);

    RETURN jsonb_build_object('success', true, 'message', 'Sponsored ' || v_item_name);
END;
$$;
