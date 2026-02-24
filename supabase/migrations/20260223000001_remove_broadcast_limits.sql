-- Migration: Remove Unused Broadcast Limits
-- Description: Removes unused max_broadcasts and max_guests_per_broadcast columns
--              from platform_event table as these limits are not enforced anywhere.

-- Drop the columns if they exist
ALTER TABLE public.platform_event DROP COLUMN IF EXISTS max_broadcasts;
ALTER TABLE public.platform_event DROP COLUMN IF EXISTS max_guests_per_broadcast;

-- Update the existing event to remove these values
UPDATE public.platform_event 
SET max_broadcasts = NULL, 
    max_guests_per_broadcast = NULL
WHERE max_broadcasts IS NOT NULL OR max_guests_per_broadcast IS NOT NULL;
