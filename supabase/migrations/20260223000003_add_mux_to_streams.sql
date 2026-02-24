-- Migration: Add mux_playback_id to streams table
-- Description: Enables Mux HLS playback for broadcasts

-- Add mux_playback_id column to streams if not exists
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS mux_playback_id TEXT;

-- Add status column if not exists
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'inactive';

-- Ensure is_live column exists
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;
