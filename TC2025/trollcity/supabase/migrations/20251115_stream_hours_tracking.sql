-- Add stream hours tracking to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_stream_hours NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_stream_start TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_stream_end TIMESTAMP DEFAULT NULL;