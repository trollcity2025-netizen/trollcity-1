-- Migration: Add mux_stream_id to streams table for webhook correlation
-- Description: Enables Mux webhook to find and update stream records

-- Add mux_stream_id column to streams if not exists
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS mux_stream_id TEXT;
