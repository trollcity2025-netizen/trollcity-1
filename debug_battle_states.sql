-- =============================================================================
-- Debug Script: Check and Fix Stuck Battle States
-- Run this in Supabase SQL Editor to diagnose why battles aren't starting
-- =============================================================================

-- 1. Check all streams and their battle status
SELECT 
    s.id as stream_id,
    s.user_id,
    up.username,
    s.is_live,
    s.is_battle,
    s.battle_id,
    s.stream_kind,
    s.title,
    s.viewer_count,
    s.created_at as stream_created
FROM public.streams s
LEFT JOIN public.user_profiles up ON s.user_id = up.id
WHERE up.role = 'broadcaster'
   OR up.username LIKE '%broadcaster%'
   OR up.email LIKE '%broadcaster%'
ORDER BY s.created_at DESC;

-- 2. Check all pending/active battles
SELECT 
    id,
    status,
    challenger_stream_id,
    opponent_stream_id,
    battle_type,
    started_at,
    created_at,
    pot_challenger,
    pot_opponent,
    score_challenger,
    score_opponent
FROM public.battles
WHERE status IN ('pending', 'active')
ORDER BY created_at DESC;

-- 3. Check battle_participants for any stuck entries
SELECT 
    bp.battle_id,
    bp.user_id,
    up.username,
    bp.team,
    bp.role,
    bp.source_stream_id
FROM public.battle_participants bp
LEFT JOIN public.user_profiles up ON bp.user_id = up.id
WHERE bp.battle_id IN (
    SELECT id FROM public.battles WHERE status IN ('pending', 'active')
);

-- 4. Check recent battles (last 10) to see recent opponents
SELECT 
    id,
    status,
    challenger_stream_id,
    opponent_stream_id,
    created_at,
    ended_at
FROM public.battles
WHERE status = 'ended'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Find match candidates for a specific broadcaster stream
-- Replace STREAM_ID_HERE with the stream ID from query #1
-- SELECT * FROM find_match_candidate('STREAM_ID_HERE'::uuid);

-- =============================================================================
-- FIX QUERIES - Run these to fix stuck states
-- =============================================================================

-- FIX 1: Reset all streams that are marked as in battle but no active battle exists
-- UPDATE public.streams 
-- SET is_battle = false, battle_id = NULL 
-- WHERE is_battle = true 
-- AND id NOT IN (
--     SELECT challenger_stream_id FROM public.battles WHERE status = 'active'
--     UNION
--     SELECT opponent_stream_id FROM public.battles WHERE status = 'active'
-- );

-- FIX 2: Cancel all pending battles that are stuck (older than 10 minutes)
-- UPDATE public.battles 
-- SET status = 'cancelled' 
-- WHERE status = 'pending' 
-- AND created_at < NOW() - INTERVAL '10 minutes';

-- FIX 3: Delete orphaned battle_participants for cancelled/ended battles
-- DELETE FROM public.battle_participants 
-- WHERE battle_id IN (
--     SELECT id FROM public.battles WHERE status = 'cancelled'
-- );

-- FIX 4: Full reset for a specific user's stream (replace USER_ID_HERE with user UUID)
-- UPDATE public.streams 
-- SET is_battle = false, battle_id = NULL 
-- WHERE user_id = 'USER_ID_HERE';
