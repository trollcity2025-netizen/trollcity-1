-- Streaming stack migration: Remove LiveKit/Bunny, add Agora/Mux
-- Add new columns for Agora and Mux to streams table

ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS kind text DEFAULT 'broadcast' CHECK (kind IN ('broadcast', 'battle', 'pod', 'jail'));
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS mux_live_stream_id text;
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS mux_playback_id text;
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS mux_stream_key text; -- Private, not exposed to frontend

-- Update existing rows: set kind based on category or other logic
UPDATE public.streams SET kind = 'battle' WHERE category = 'battle' OR title ILIKE '%battle%';
-- For pods and jail, if they are in streams, but probably separate tables

-- Rename agora_channel to agora_channel_name if needed, but keep for now

-- Add indexes if needed
CREATE INDEX IF NOT EXISTS idx_streams_kind ON public.streams(kind);
CREATE INDEX IF NOT EXISTS idx_streams_mux_live_stream_id ON public.streams(mux_live_stream_id);

-- Update status to use 'live' | 'ended' | ...
-- Currently status is text default 'live', is_live boolean
-- Perhaps keep as is, or update.

-- For pods, add similar columns to pod_rooms
ALTER TABLE public.pod_rooms ADD COLUMN IF NOT EXISTS mux_live_stream_id text;
ALTER TABLE public.pod_rooms ADD COLUMN IF NOT EXISTS mux_playback_id text;
ALTER TABLE public.pod_rooms ADD COLUMN IF NOT EXISTS mux_stream_key text;
ALTER TABLE public.pod_rooms ADD COLUMN IF NOT EXISTS agora_channel_name text;

-- For battles, add to troll_battles
-- First, check if troll_battles exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_battles') THEN
        ALTER TABLE public.troll_battles ADD COLUMN IF NOT EXISTS mux_live_stream_id text;
        ALTER TABLE public.troll_battles ADD COLUMN IF NOT EXISTS mux_playback_id text;
        ALTER TABLE public.troll_battles ADD COLUMN IF NOT EXISTS mux_stream_key text;
        ALTER TABLE public.troll_battles ADD COLUMN IF NOT EXISTS agora_channel_name text;
    END IF;
END $$;

-- For jail
ALTER TABLE public.jail ADD COLUMN IF NOT EXISTS mux_live_stream_id text;
ALTER TABLE public.jail ADD COLUMN IF NOT EXISTS mux_playback_id text;
ALTER TABLE public.jail ADD COLUMN IF NOT EXISTS mux_stream_key text;
ALTER TABLE public.jail ADD COLUMN IF NOT EXISTS agora_channel_name text;