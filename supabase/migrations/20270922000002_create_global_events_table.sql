CREATE TABLE IF NOT EXISTS public.global_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    icon TEXT,
    priority INTEGER DEFAULT 1,
    metadata JSONB,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_events_created_at ON public.global_events(created_at DESC);
