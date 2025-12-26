-- Troll Drop Feature Database Setup
-- Run this SQL in your Supabase SQL editor to set up the troll_drops table

CREATE TABLE IF NOT EXISTS public.troll_drops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  color VARCHAR(10) NOT NULL CHECK (color IN ('red', 'green')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  participants JSONB DEFAULT '[]'::jsonb,
  total_amount INTEGER NOT NULL DEFAULT 5000,
  claimed BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_troll_drops_stream_id ON public.troll_drops(stream_id);
CREATE INDEX IF NOT EXISTS idx_troll_drops_created_at ON public.troll_drops(created_at);
CREATE INDEX IF NOT EXISTS idx_troll_drops_expires_at ON public.troll_drops(expires_at);

-- Add RLS policies if using row-level security
ALTER TABLE public.troll_drops ENABLE ROW LEVEL SECURITY;

-- Anyone can read troll drops for a stream they have access to
CREATE POLICY "Allow read access to troll drops"
  ON public.troll_drops
  FOR SELECT
  USING (true);

-- Streamers can manage their own troll drops
CREATE POLICY "Allow streamer to manage troll drops"
  ON public.troll_drops
  FOR UPDATE
  USING (
    stream_id IN (
      SELECT id FROM public.streams WHERE broadcaster_id = auth.uid()
    )
  );

-- System can create troll drops
CREATE POLICY "Allow creation of troll drops"
  ON public.troll_drops
  FOR INSERT
  WITH CHECK (true);
