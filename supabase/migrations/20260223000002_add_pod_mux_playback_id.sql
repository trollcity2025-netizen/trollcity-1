-- Migration: Add mux_playback_id to pod_rooms
-- Description: Allows pods to have HLS streaming like broadcasts

-- Add mux_playback_id column to pod_rooms if not exists
ALTER TABLE public.pod_rooms ADD COLUMN IF NOT EXISTS mux_playback_id TEXT;

-- Add name column to pod_rooms if not exists (needed for querying)
ALTER TABLE public.pod_rooms ADD COLUMN IF NOT EXISTS name TEXT;
