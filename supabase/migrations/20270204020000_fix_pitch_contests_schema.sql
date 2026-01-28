-- Add missing columns used in TrotingAdminView
ALTER TABLE public.pitch_contests 
ADD COLUMN IF NOT EXISTS week_start DATE,
ADD COLUMN IF NOT EXISTS week_end DATE;

-- Fix constraint to ensure 'submission' is allowed
ALTER TABLE public.pitch_contests DROP CONSTRAINT IF EXISTS pitch_contests_status_check;

ALTER TABLE public.pitch_contests
ADD CONSTRAINT pitch_contests_status_check
CHECK (status IN ('submission', 'voting', 'review', 'completed'));
