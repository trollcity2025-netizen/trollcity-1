-- Fix existing streams that have null broadcaster_id, streamer_id, or owner_id
-- These should all match user_id for consistency

-- Update streams where broadcaster_id is null but user_id exists
UPDATE public.streams
SET broadcaster_id = user_id
WHERE broadcaster_id IS NULL AND user_id IS NOT NULL;

-- Update streams where streamer_id is null but user_id exists
UPDATE public.streams
SET streamer_id = user_id
WHERE streamer_id IS NULL AND user_id IS NOT NULL;

-- Update streams where owner_id is null but user_id exists
UPDATE public.streams
SET owner_id = user_id
WHERE owner_id IS NULL AND user_id IS NOT NULL;

-- Verify the fix
SELECT 
  id,
  user_id,
  broadcaster_id,
  streamer_id,
  owner_id,
  title,
  status,
  is_live
FROM public.streams
WHERE is_live = true
ORDER BY started_at DESC
LIMIT 10;
