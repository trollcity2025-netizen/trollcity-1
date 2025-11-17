-- Migration: create user_stream_bans table
-- Run this in Supabase SQL editor or via supabase migrations

CREATE TABLE IF NOT EXISTS public.user_stream_bans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  streamer_id UUID NOT NULL,
  user_id UUID NOT NULL,
  stream_id UUID NULL,
  coin_cost INTEGER DEFAULT 1000,
  is_active BOOLEAN DEFAULT true,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  removed_date TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_user_stream_bans_streamer_id ON public.user_stream_bans (streamer_id);
CREATE INDEX IF NOT EXISTS idx_user_stream_bans_user_id ON public.user_stream_bans (user_id);
CREATE INDEX IF NOT EXISTS idx_user_stream_bans_stream_id ON public.user_stream_bans (stream_id);
