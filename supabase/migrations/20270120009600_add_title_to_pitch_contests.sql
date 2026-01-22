-- Add title column to pitch_contests

ALTER TABLE public.pitch_contests 
ADD COLUMN IF NOT EXISTS title TEXT;

-- (Removed update using week_start; column does not exist. If needed, set a default title in a later migration.)
