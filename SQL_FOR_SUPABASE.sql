-- ============================================
-- SQL MIGRATIONS FOR MUX INTEGRATION
-- Run these in Supabase SQL Editor
-- ============================================

-- Add mux_playback_id to pod_rooms table
ALTER TABLE public.pod_rooms ADD COLUMN IF NOT EXISTS mux_playback_id TEXT;

-- Add mux_playback_id and status to streams table
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS mux_playback_id TEXT;
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'inactive';

-- ============================================
-- REMOVE DAILY LIMITS
-- ============================================

-- Remove daily pod limit from can_start_pod function
-- (This is done via migration file 20260223000000_remove_daily_pod_limit.sql)

-- Remove unused broadcast limits from platform_event table
ALTER TABLE public.platform_event DROP COLUMN IF EXISTS max_broadcasts;
ALTER TABLE public.platform_event DROP COLUMN IF EXISTS max_guests_per_broadcast;
