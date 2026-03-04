-- ============================================================================
-- MIGRATION: Recalculate User Levels Based on Gift History
-- ============================================================================
-- This script recalculates all users' XP and levels based on gifts they've sent
-- and received. It should be run as a one-time migration to fix level data.
--
-- XP Calculation Rules (based on process_gift_xp function):
-- - Gift Sender: 1 XP per coin spent (gifter_base rate)
-- - Gift Receiver: 1 XP per coin received (broadcaster_base rate)
-- - Self-gifting is excluded
-- - Only processed/completed gifts are counted
-- ============================================================================

-- Start transaction
BEGIN;

-- Step 1: Create a temporary table to hold calculated XP for each user
CREATE TEMP TABLE temp_user_gift_xp AS
WITH gift_totals AS (
    -- Calculate XP from gifts sent
    SELECT 
        sender_id AS user_id,
        COALESCE(SUM(amount), 0) AS xp_from_sent
    FROM public.gift_ledger
    WHERE status IN ('processed', 'completed', 'confirmed')
        AND sender_id IS NOT NULL
        AND sender_id != receiver_id  -- Exclude self-gifts
    GROUP BY sender_id
    
    UNION ALL
    
    -- Calculate XP from gifts received
    SELECT 
        receiver_id AS user_id,
        COALESCE(SUM(amount), 0) AS xp_from_received
    FROM public.gift_ledger
    WHERE status IN ('processed', 'completed', 'confirmed')
        AND receiver_id IS NOT NULL
        AND sender_id != receiver_id  -- Exclude self-gifts
    GROUP BY receiver_id
)
SELECT 
    user_id,
    SUM(xp_from_sent) AS total_gift_xp
FROM gift_totals
GROUP BY user_id;

-- Step 2: Add index for faster lookups
CREATE INDEX idx_temp_user_gift_xp_user_id ON temp_user_gift_xp(user_id);

-- Step 3: Create or update the XP calculation function if not exists
CREATE OR REPLACE FUNCTION public.calculate_level_from_xp(p_total_xp BIGINT)
RETURNS TABLE(level INT, xp_to_next_level INT, xp_progress NUMERIC) AS $$
DECLARE
    v_level INT := 1;
    v_xp_needed INT := 100;  -- XP needed for level 2
    v_cumulative_xp INT := 0;
    v_remaining_xp BIGINT;
BEGIN
    -- Level thresholds (customize these based on your game's progression)
    -- Level 1: 0-99 XP
    -- Level 2: 100-249 XP (+150)
    -- Level 3: 250-499 XP (+250)
    -- Level 4: 500-799 XP (+300)
    -- etc.
    
    IF p_total_xp < 100 THEN
        v_level := 1;
        v_xp_needed := 100;
        v_cumulative_xp := 0;
    ELSIF p_total_xp < 250 THEN
        v_level := 2;
        v_xp_needed := 150;
        v_cumulative_xp := 100;
    ELSIF p_total_xp < 500 THEN
        v_level := 3;
        v_xp_needed := 250;
        v_cumulative_xp := 250;
    ELSIF p_total_xp < 800 THEN
        v_level := 4;
        v_xp_needed := 300;
        v_cumulative_xp := 500;
    ELSIF p_total_xp < 1200 THEN
        v_level := 5;
        v_xp_needed := 400;
        v_cumulative_xp := 800;
    ELSIF p_total_xp < 1700 THEN
        v_level := 6;
        v_xp_needed := 500;
        v_cumulative_xp := 1200;
    ELSIF p_total_xp < 2300 THEN
        v_level := 7;
        v_xp_needed := 600;
        v_cumulative_xp := 1700;
    ELSIF p_total_xp < 3000 THEN
        v_level := 8;
        v_xp_needed := 700;
        v_cumulative_xp := 2300;
    ELSIF p_total_xp < 4000 THEN
        v_level := 9;
        v_xp_needed := 1000;
        v_cumulative_xp := 3000;
    ELSE
        -- Level 10+: Each level requires 1000 more XP
        v_level := 10 + ((p_total_xp - 4000) / 1000)::INT;
        v_xp_needed := 1000;
        v_cumulative_xp := 4000 + ((v_level - 10) * 1000);
    END IF;
    
    v_remaining_xp := p_total_xp - v_cumulative_xp;
    
    RETURN QUERY SELECT 
        v_level,
        v_xp_needed,
        (v_remaining_xp::NUMERIC / v_xp_needed::NUMERIC * 100)::NUMERIC;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Update user_profiles with new total_xp from gifts
UPDATE public.user_profiles up
SET 
    total_xp = COALESCE(t.total_gift_xp, 0),
    updated_at = NOW()
FROM temp_user_gift_xp t
WHERE up.id = t.user_id;

-- Step 5: Also update users with 0 XP if they have no gift history
UPDATE public.user_profiles up
SET 
    total_xp = 0,
    updated_at = NOW()
WHERE up.id NOT IN (SELECT user_id FROM temp_user_gift_xp)
    AND (up.total_xp IS NULL OR up.total_xp > 0);

-- Step 6: Insert or update user_stats with calculated levels
INSERT INTO public.user_stats (
    user_id,
    level,
    xp_total,
    xp_to_next_level,
    xp_progress,
    updated_at
)
SELECT 
    up.id,
    (calculate_level_from_xp(COALESCE(up.total_xp, 0)::BIGINT)).level,
    COALESCE(up.total_xp, 0),
    (calculate_level_from_xp(COALESCE(up.total_xp, 0)::BIGINT)).xp_to_next_level,
    (calculate_level_from_xp(COALESCE(up.total_xp, 0)::BIGINT)).xp_progress,
    NOW()
FROM public.user_profiles up
ON CONFLICT (user_id) DO UPDATE SET
    level = EXCLUDED.level,
    xp_total = EXCLUDED.xp_total,
    xp_to_next_level = EXCLUDED.xp_to_next_level,
    xp_progress = EXCLUDED.xp_progress,
    updated_at = EXCLUDED.updated_at;

-- Step 7: Update level and xp fields in user_profiles for backward compatibility
-- First check if columns exist and add them if needed
DO $$
BEGIN
    -- Add level column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'level') THEN
        ALTER TABLE public.user_profiles ADD COLUMN level INT DEFAULT 1;
    END IF;
    
    -- Add xp column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'xp') THEN
        ALTER TABLE public.user_profiles ADD COLUMN xp BIGINT DEFAULT 0;
    END IF;
    
    -- Add total_xp column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'total_xp') THEN
        ALTER TABLE public.user_profiles ADD COLUMN total_xp BIGINT DEFAULT 0;
    END IF;
    
    -- Add next_level_xp column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'next_level_xp') THEN
        ALTER TABLE public.user_profiles ADD COLUMN next_level_xp INT DEFAULT 100;
    END IF;
END $$;

-- Now update the columns that exist
UPDATE public.user_profiles up
SET 
    level = COALESCE(us.level, up.level, 1),
    xp = COALESCE(us.xp_total, up.xp, 0),
    total_xp = COALESCE(us.xp_total, up.total_xp, 0),
    next_level_xp = COALESCE(us.xp_to_next_level, up.next_level_xp, 100),
    updated_at = NOW()
FROM public.user_stats us
WHERE up.id = us.user_id;

-- Step 8: Also populate xp_ledger with gift records (for idempotency tracking)
-- This ensures future gift processing won't double-count these
INSERT INTO public.xp_ledger (
    user_id,
    xp_amount,
    source_type,
    source_id,
    reason,
    metadata
)
SELECT 
    sender_id,
    amount,
    'gift_sent',
    id::TEXT,
    'Historical gift - level recalculation',
    jsonb_build_object('receiver_id', receiver_id, 'stream_id', stream_id, 'recalculated', true)
FROM public.gift_ledger
WHERE status IN ('processed', 'completed', 'confirmed')
    AND sender_id IS NOT NULL
    AND sender_id != receiver_id
ON CONFLICT (user_id, source_type, source_id) DO NOTHING;

INSERT INTO public.xp_ledger (
    user_id,
    xp_amount,
    source_type,
    source_id,
    reason,
    metadata
)
SELECT 
    receiver_id,
    amount,
    'gift_received',
    id::TEXT,
    'Historical gift - level recalculation',
    jsonb_build_object('sender_id', sender_id, 'stream_id', stream_id, 'recalculated', true)
FROM public.gift_ledger
WHERE status IN ('processed', 'completed', 'confirmed')
    AND receiver_id IS NOT NULL
    AND sender_id != receiver_id
ON CONFLICT (user_id, source_type, source_id) DO NOTHING;

-- Step 9: Generate report of changes
SELECT 
    'RECALCULATION COMPLETE' AS status,
    COUNT(DISTINCT up.id) AS users_updated,
    AVG(up.total_xp)::INT AS avg_xp,
    MAX(up.total_xp)::INT AS max_xp,
    MIN(up.total_xp)::INT AS min_xp,
    AVG(us.level)::NUMERIC(4,1) AS avg_level
FROM public.user_profiles up
LEFT JOIN public.user_stats us ON up.id = us.user_id;

-- Step 10: Show top 10 users by level
SELECT 
    up.username,
    us.level,
    us.xp_total,
    us.xp_to_next_level,
    us.xp_progress::INT AS progress_pct
FROM public.user_profiles up
JOIN public.user_stats us ON up.id = us.user_id
ORDER BY us.xp_total DESC
LIMIT 10;

-- Cleanup
DROP TABLE IF EXISTS temp_user_gift_xp;

-- Commit transaction
COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run these after the migration to verify results)
-- ============================================================================

-- Check users with highest levels
-- SELECT username, level, total_xp FROM user_profiles WHERE level > 1 ORDER BY total_xp DESC LIMIT 20;

-- Check distribution of levels
-- SELECT level, COUNT(*) FROM user_profiles GROUP BY level ORDER BY level;

-- Check if any users have NULL xp
-- SELECT COUNT(*) FROM user_profiles WHERE total_xp IS NULL;

-- Compare gift_ledger totals with user_stats
-- SELECT 
--     'Gift Ledger' as source,
--     COALESCE(SUM(amount), 0) as total_xp
-- FROM gift_ledger 
-- WHERE status IN ('processed', 'completed')
-- UNION ALL
-- SELECT 
--     'User Stats' as source,
--     COALESCE(SUM(xp_total), 0) as total_xp
-- FROM user_stats;
