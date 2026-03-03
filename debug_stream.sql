-- Debug: Check stream status
-- Run this in Supabase SQL Editor to verify the stream exists and is live

SELECT 
    id,
    user_id,
    status,
    is_live,
    stream_kind,
    title,
    created_at,
    ended_at
FROM public.streams 
WHERE id = '866923ee-f050-4940-9687-4b4186f31f27';

-- Also check if there are any active/live streams for reference:
SELECT 
    id,
    user_id,
    status,
    is_live,
    stream_kind
FROM public.streams 
WHERE status = 'live' 
  AND is_live = TRUE
ORDER BY created_at DESC
LIMIT 10;
