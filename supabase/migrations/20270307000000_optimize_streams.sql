-- Optimization Migration
-- 1. Ensure streams table has essential columns
-- 2. Add room_name and hls_path
-- 3. Ensure no high-frequency triggers exist (we'll check this manually, but this script ensures columns exist)

-- Add room_name if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'room_name') THEN
        ALTER TABLE public.streams ADD COLUMN room_name TEXT;
    END IF;
END $$;

-- Add hls_path if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'hls_path') THEN
        ALTER TABLE public.streams ADD COLUMN hls_path TEXT;
    END IF;
END $$;

-- Populate room_name from id if empty (assuming room_name = id for now as default)
UPDATE public.streams SET room_name = id::text WHERE room_name IS NULL;

-- Populate hls_path if empty and hls_url is present (attempt to extract)
-- Or just set default format
UPDATE public.streams 
SET hls_path = '/streams/' || id || '/master.m3u8'
WHERE hls_path IS NULL;

-- Ensure start_time and ended_at exist (start_time usually exists, check ended_at)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'ended_at') THEN
        ALTER TABLE public.streams ADD COLUMN ended_at TIMESTAMPTZ;
    END IF;
END $$;

-- Index optimization for essential lookups
CREATE INDEX IF NOT EXISTS idx_streams_room_name ON public.streams(room_name);
CREATE INDEX IF NOT EXISTS idx_streams_is_live ON public.streams(is_live);
