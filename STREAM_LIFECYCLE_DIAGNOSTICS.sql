-- STREAM LIFECYCLE DIAGNOSTICS
-- Run these queries to verify stream integrity

-- 1. Check for multiple live streams per user (should be 0 or 1 per user)
SELECT 
    user_id,
    COUNT(*) as live_stream_count,
    array_agg(id) as stream_ids,
    array_agg(created_at) as created_times
FROM streams
WHERE is_live = true
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY live_stream_count DESC;

-- 2. Check streams that are marked is_live=true but status != 'live'
SELECT 
    id,
    user_id,
    is_live,
    status,
    created_at,
    started_at,
    ended_at
FROM streams
WHERE is_live = true 
  AND status != 'live'
ORDER BY created_at DESC
LIMIT 20;

-- 3. Check streams that are status='live' but is_live=false
SELECT 
    id,
    user_id,
    is_live,
    status,
    created_at,
    started_at,
    ended_at
FROM streams
WHERE status = 'live' 
  AND is_live = false
ORDER BY created_at DESC
LIMIT 20;

-- 4. Find users with multiple stream rows (live or ended)
SELECT 
    user_id,
    COUNT(*) as total_stream_count,
    COUNT(*) FILTER (WHERE is_live = true) as live_count,
    COUNT(*) FILTER (WHERE is_live = false) as ended_count,
    MAX(created_at) as latest_stream
FROM streams
GROUP BY user_id
HAVING COUNT(*) > 5  -- Users with many streams
ORDER BY total_stream_count DESC
LIMIT 20;

-- 5. Check for orphaned battle references (battles pointing to non-existent streams)
SELECT 
    b.id as battle_id,
    b.status as battle_status,
    b.challenger_stream_id,
    b.opponent_stream_id,
    cs.id as challenger_exists,
    os.id as opponent_exists,
    cs.is_live as challenger_is_live,
    os.is_live as opponent_is_live
FROM battles b
LEFT JOIN streams cs ON cs.id = b.challenger_stream_id
LEFT JOIN streams os ON os.id = b.opponent_stream_id
WHERE b.status = 'active'
  AND (cs.id IS NULL OR os.id IS NULL OR cs.is_live = false OR os.is_live = false);

-- 6. Get detailed stream info for a specific user (replace '<user-id>')
-- SELECT id, user_id, is_live, status, created_at, started_at, ended_at, title
-- FROM streams
-- WHERE user_id = '<user-id>'
-- ORDER BY created_at DESC;

-- 7. Clean up duplicate live streams for a user (KEEP THE LATEST)
-- WARNING: Run this only after verifying which streams to keep
-- WITH latest_live AS (
--     SELECT DISTINCT ON (user_id) id
--     FROM streams
--     WHERE is_live = true
--     ORDER BY user_id, created_at DESC
-- )
-- UPDATE streams
-- SET is_live = false, status = 'ended', ended_at = NOW()
-- WHERE is_live = true
--   AND id NOT IN (SELECT id FROM latest_live);

-- 8. Verify stream count statistics
SELECT 
    'Total Streams' as metric,
    COUNT(*) as value
FROM streams
UNION ALL
SELECT 
    'Live Streams',
    COUNT(*) FILTER (WHERE is_live = true)
FROM streams
UNION ALL
SELECT 
    'Streams with status=live',
    COUNT(*) FILTER (WHERE status = 'live')
FROM streams
UNION ALL
SELECT 
    'Streams with both is_live=true AND status=live',
    COUNT(*) FILTER (WHERE is_live = true AND status = 'live')
FROM streams
UNION ALL
SELECT 
    'Streams with mismatched status',
    COUNT(*) FILTER (WHERE (is_live = true AND status != 'live') OR (is_live = false AND status = 'live'))
FROM streams;

-- 9. Check active battles with stream details
SELECT 
    b.id as battle_id,
    b.challenger_stream_id,
    cs.is_live as challenger_is_live,
    cs.status as challenger_status,
    b.opponent_stream_id,
    os.is_live as opponent_is_live,
    os.status as opponent_status,
    b.started_at,
    b.status
FROM battles b
LEFT JOIN streams cs ON cs.id = b.challenger_stream_id
LEFT JOIN streams os ON os.id = b.opponent_stream_id
WHERE b.status = 'active'
ORDER BY b.started_at DESC
LIMIT 20;

-- 10. Fix script: End all streams that have been live for too long (e.g., > 8 hours)
-- UPDATE streams
-- SET is_live = false, 
--     status = 'ended',
--     ended_at = NOW()
-- WHERE is_live = true 
--   AND started_at < NOW() - INTERVAL '8 hours';
