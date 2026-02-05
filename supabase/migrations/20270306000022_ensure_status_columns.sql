-- Ensure status column exists for court_sessions
ALTER TABLE public.court_sessions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waiting';

-- Ensure status column exists for pod_rooms (optional, but helpful for consistency)
ALTER TABLE public.pod_rooms
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';

-- Add index on status for performance
CREATE INDEX IF NOT EXISTS idx_court_sessions_status ON public.court_sessions(status);
CREATE INDEX IF NOT EXISTS idx_pod_rooms_status ON public.pod_rooms(status);
