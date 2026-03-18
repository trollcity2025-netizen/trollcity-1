-- Fix for battle_queue not being cleaned up after battle ends
-- This script:
-- 1. Cleans up stale battle_queue entries
-- 2. Ensures streams have correct battle state
-- Run this in Supabase SQL Editor

-- Step 1: Clean up any orphaned battle_queue entries where the battle is no longer active
DELETE FROM public.battle_queue 
WHERE battle_id IS NOT NULL 
AND NOT EXISTS (
  SELECT 1 FROM public.battles b 
  WHERE b.id = battle_queue.battle_id 
  AND b.status = 'active'
);

-- Step 2: Clean up battle_queue entries for streams that are no longer in battle
DELETE FROM public.battle_queue 
WHERE status = 'battling' 
AND stream_id IN (
  SELECT id FROM public.streams 
  WHERE is_battle = false OR battle_id IS NULL
);

-- Step 3: Ensure streams that should not be in battle have is_battle = false
UPDATE public.streams 
SET is_battle = false 
WHERE is_battle = true 
AND (
  battle_id IS NULL 
  OR NOT EXISTS (
    SELECT 1 FROM public.battles b 
    WHERE b.id = streams.battle_id 
    AND b.status = 'active'
  )
);

-- Step 4: Also clean up waiting entries older than 10 minutes
DELETE FROM public.battle_queue 
WHERE status = 'waiting' 
AND created_at < now() - interval '10 minutes';

-- Verify the cleanup
SELECT 
  (SELECT COUNT(*) FROM public.battle_queue WHERE status = 'battling') as battling_entries,
  (SELECT COUNT(*) FROM public.battle_queue WHERE status = 'waiting') as waiting_entries,
  (SELECT COUNT(*) FROM public.streams WHERE is_battle = true) as streams_in_battle;
