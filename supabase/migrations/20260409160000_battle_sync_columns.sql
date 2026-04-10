-- Add battle synchronization columns for 2-broadcaster ready system
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS opponent_stream_id TEXT;
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS host_ready BOOLEAN DEFAULT false;
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS opponent_ready BOOLEAN DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_battles_opponent_stream_id ON public.battles(opponent_stream_id);
CREATE INDEX IF NOT EXISTS idx_battles_status_ready ON public.battles(status, host_ready, opponent_ready);