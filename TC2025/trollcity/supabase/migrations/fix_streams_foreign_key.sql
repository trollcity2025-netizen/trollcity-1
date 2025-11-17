-- Fix foreign key relationship between streams and profiles
-- First, we need to drop the existing foreign key constraint
ALTER TABLE public.streams 
DROP CONSTRAINT IF EXISTS streams_streamer_id_fkey;

-- Add the new foreign key constraint to reference profiles table
ALTER TABLE public.streams 
ADD CONSTRAINT streams_streamer_id_fkey 
FOREIGN KEY (streamer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;