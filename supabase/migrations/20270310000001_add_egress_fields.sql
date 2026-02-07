
-- Add egress_id and hls_started_at to streams table for idempotency
ALTER TABLE public.streams 
ADD COLUMN IF NOT EXISTS egress_id TEXT,
ADD COLUMN IF NOT EXISTS hls_started_at TIMESTAMPTZ;

-- Also add to pod_rooms and court_sessions just in case, though the user focused on streams
ALTER TABLE public.pod_rooms 
ADD COLUMN IF NOT EXISTS egress_id TEXT,
ADD COLUMN IF NOT EXISTS hls_started_at TIMESTAMPTZ;

ALTER TABLE public.court_sessions 
ADD COLUMN IF NOT EXISTS egress_id TEXT,
ADD COLUMN IF NOT EXISTS hls_started_at TIMESTAMPTZ;
