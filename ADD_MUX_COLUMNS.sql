-- Run this SQL to add Mux streaming columns to your database
-- This adds the required columns for RTMP streaming via Mux

-- Add mux_stream_key and mux_rtmp_url columns to streams table
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS mux_stream_key TEXT;
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS mux_rtmp_url TEXT;

-- Add mux_stream_key and mux_rtmp_url columns to pod_rooms table
ALTER TABLE public.pod_rooms ADD COLUMN IF NOT EXISTS mux_stream_key TEXT;
ALTER TABLE public.pod_rooms ADD COLUMN IF NOT EXISTS mux_rtmp_url TEXT;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('streams', 'pod_rooms') 
AND column_name LIKE 'mux%';
