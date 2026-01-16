
-- Create telemetry_events table
CREATE TABLE IF NOT EXISTS public.telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    env TEXT,
    app_version TEXT,
    event_type TEXT NOT NULL,
    message TEXT,
    stack TEXT,
    fingerprint TEXT,
    url TEXT,
    user_id_hash TEXT,
    session_id TEXT,
    device TEXT,
    browser TEXT,
    os TEXT,
    severity TEXT,
    tags JSONB DEFAULT '{}'::jsonb,
    breadcrumbs JSONB DEFAULT '[]'::jsonb,
    request_info JSONB DEFAULT '{}'::jsonb,
    extra JSONB DEFAULT '{}'::jsonb
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_telemetry_fingerprint_created ON public.telemetry_events (fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_event_type_created ON public.telemetry_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_user_hash ON public.telemetry_events (user_id_hash);

-- Enable RLS
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

-- Policies

-- Service role should have full access (implicit, but good to know)

-- Admins can view all telemetry
DROP POLICY IF EXISTS "Admins can view telemetry" ON public.telemetry_events;
CREATE POLICY "Admins can view telemetry"
    ON public.telemetry_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
        )
    );

-- No public insert policy needed if we strictly use the backend endpoint with service role.
-- However, if we ever want direct client reporting (fallback), we might need it.
-- For now, adhering to "Send all telemetry to a single backend endpoint" instruction.
