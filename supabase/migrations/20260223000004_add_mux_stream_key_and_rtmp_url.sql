-- Migration: Add mux_stream_key and mux_rtmp_url to streams and pod_rooms
-- Description: Complete Mux RTMP streaming setup for broadcasts and pods

-- Add mux_stream_key and mux_rtmp_url columns to streams if not exists
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS mux_stream_key TEXT;
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS mux_rtmp_url TEXT;

-- Add mux_stream_key and mux_rtmp_url columns to pod_rooms if not exists
ALTER TABLE public.pod_rooms ADD COLUMN IF NOT EXISTS mux_stream_key TEXT;
ALTER TABLE public.pod_rooms ADD COLUMN IF NOT EXISTS mux_rtmp_url TEXT;
