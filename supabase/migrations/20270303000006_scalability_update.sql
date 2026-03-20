
-- Scalability Upgrade Migration
-- Implements Ledger-based Gifting, Broadcaster Stats, and Safe RPCs

-- 1. Gift Ledger (Append-Only)
CREATE TABLE IF NOT EXISTS public.gift_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id),
    receiver_id UUID NOT NULL REFERENCES public.user_profiles(id),
    stream_id UUID, -- Optional, if associated with a stream
    gift_id TEXT NOT NULL, -- ID or Slug
    amount INTEGER NOT NULL, -- Cost in Coins
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processed, failed
    idempotency_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT
);

-- Index for batch processing
CREATE INDEX IF NOT EXISTS idx_gift_ledger_pending ON public.gift_ledger(status, created_at) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_ledger_idempotency ON public.gift_ledger(sender_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Broadcaster Stats (Materialized-like table for Leaderboards)
CREATE TABLE IF NOT EXISTS public.broadcaster_stats (
    user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id),
    total_gifts_24h INTEGER DEFAULT 0,
    total_gifts_all_time INTEGER DEFAULT 0,
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcaster_stats_24h ON public.broadcaster_stats(total_gifts_24h DESC);

-- BACKFILL broadcaster_stats from existing gift_transactions (approximate)
INSERT INTO public.broadcaster_stats (user_id, total_gifts_24h, total_gifts_all_time, last_updated_at)
SELECT 
    to_user_id,
    COALESCE(SUM(coins) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 0),
    COALESCE(SUM(coins), 0),
    NOW()
FROM public.gift_transactions
GROUP BY to_user_id
ON CONFLICT (user_id) DO NOTHING;

-- 3. RPC: Send Gift (Ledger Entry Only - Single Write)
CREATE OR REPLACE FUNCTION send_gift_ledger(
    p_receiver_id UUID,
    p_gift_id TEXT,
    p_amount INTEGER,
    p_stream_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_id UUID;
    v_current_balance INTEGER;
BEGIN
    v_sender_id := auth.uid();
    IF v_sender_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- 1. Read Balance (No Lock) - Fast Check
    SELECT troll_coins INTO v_current_balance FROM public.user_profiles WHERE id = v_sender_id;
    
    IF v_current_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds (checked)');
    END IF;

    -- 2. Insert into Ledger (The Only Write)
    BEGIN
        INSERT INTO public.gift_ledger (
            sender_id, receiver_id, stream_id, gift_id, amount, metadata, status, idempotency_key
        ) VALUES (
            v_sender_id, p_receiver_id, p_stream_id, p_gift_id, p_amount, p_metadata, 'pending', p_idempotency_key
        );
    EXCEPTION WHEN unique_violation THEN
        -- Handle Idempotency gracefully
        RETURN jsonb_build_object('success', true, 'message', 'Gift already sent (idempotent)', 'status', 'pending');
    END;

    RETURN jsonb_build_object('success', true, 'status', 'pending');
END;
$$;

-- 4. RPC: Process Gift Ledger (Batch Processor)
CREATE OR REPLACE FUNCTION process_gift_ledger_batch(p_batch_size INTEGER DEFAULT 1000)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_processed_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_sender_totals RECORD;
    v_receiver_totals RECORD;
BEGIN
    -- 1. Lock Pending Rows (Skip Locked to allow parallel workers)
    CREATE TEMPORARY TABLE temp_batch AS
    SELECT * FROM public.gift_ledger
    WHERE status = 'pending'
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED;

    IF NOT EXISTS (SELECT 1 FROM temp_batch) THEN
        DROP TABLE temp_batch;
        RETURN jsonb_build_object('success', true, 'processed', 0, 'message', 'No pending gifts');
    END IF;

    -- 2. Process by Sender (Deduct Balance)
    FOR v_sender_totals IN 
        SELECT sender_id, SUM(amount) as total_spend 
        FROM temp_batch 
        GROUP BY sender_id
    LOOP
        -- Check and Deduct
        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_sender_totals.total_spend
        WHERE id = v_sender_totals.sender_id AND troll_coins >= v_sender_totals.total_spend;

        IF FOUND THEN
            -- Success
            NULL;
        ELSE
            -- Fail: Insufficient funds
            UPDATE public.gift_ledger
            SET status = 'failed', error_message = 'Insufficient funds at batch processing', processed_at = NOW()
            WHERE id IN (SELECT id FROM temp_batch WHERE sender_id = v_sender_totals.sender_id);
            
            v_failed_count := v_failed_count + (SELECT COUNT(*) FROM temp_batch WHERE sender_id = v_sender_totals.sender_id);
            
            -- Remove from temp_batch so we don't credit receiver
            DELETE FROM temp_batch WHERE sender_id = v_sender_totals.sender_id;
        END IF;
    END LOOP;

    -- 3. Credit Receivers (Bulk Update)
    FOR v_receiver_totals IN
        SELECT receiver_id, SUM(amount) as total_receive
        FROM temp_batch
        GROUP BY receiver_id
    LOOP
        UPDATE public.user_profiles
        SET total_earned_coins = COALESCE(total_earned_coins, 0) + v_receiver_totals.total_receive
        WHERE id = v_receiver_totals.receiver_id;
        
        -- Update Broadcaster Stats
        INSERT INTO public.broadcaster_stats (user_id, total_gifts_24h, total_gifts_all_time, last_updated_at)
        VALUES (v_receiver_totals.receiver_id, v_receiver_totals.total_receive, v_receiver_totals.total_receive, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            total_gifts_24h = broadcaster_stats.total_gifts_24h + EXCLUDED.total_gifts_24h,
            total_gifts_all_time = broadcaster_stats.total_gifts_all_time + EXCLUDED.total_gifts_all_time,
            last_updated_at = NOW();
    END LOOP;

     -- 4. Mark remaining as Processed
     UPDATE public.gift_ledger
     SET status = 'processed', processed_at = NOW()
     WHERE id IN (SELECT id FROM temp_batch);
 
     -- 5. Grant XP for each gift
     FOR v_gift IN
         SELECT id, stream_id
         FROM temp_batch
     LOOP
         PERFORM public.process_gift_xp(v_gift.id, v_gift.stream_id);
     END LOOP;
 
     v_processed_count := (SELECT COUNT(*) FROM temp_batch);

    DROP TABLE temp_batch;

    RETURN jsonb_build_object('success', true, 'processed', v_processed_count, 'failed', v_failed_count);
END;
$$;

-- 5. Safe Stream Fetch (Pagination + Column Selection)
CREATE OR REPLACE FUNCTION get_active_streams_paged(
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    broadcaster_id UUID,
    title TEXT,
    category TEXT,
    current_viewers INTEGER,
    start_time TIMESTAMPTZ,
    thumbnail_url TEXT,
    broadcaster_username TEXT,
    broadcaster_avatar TEXT,
    broadcaster_dob TEXT, -- Added for compatibility
    stream_momentum JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.broadcaster_id,
        s.title,
        s.category,
        s.current_viewers,
        s.start_time,
        s.thumbnail_url,
        u.username,
        u.avatar_url,
        u.date_of_birth,
        NULL::jsonb
    FROM public.streams s
    JOIN public.user_profiles u ON s.broadcaster_id = u.id
    WHERE s.is_live = true
    ORDER BY s.current_viewers DESC, s.start_time DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
