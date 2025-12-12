-- Court Sessions - Single source of truth for court state
-- Authority presence triggers automatic court session start

CREATE TABLE IF NOT EXISTS court_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    status court_status_enum DEFAULT 'waiting',
    started_by UUID REFERENCES auth.users(id),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Court status enum
DO $$ BEGIN
    CREATE TYPE court_status_enum AS ENUM ('waiting', 'live', 'ended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_court_sessions_status ON court_sessions(status);
CREATE INDEX IF NOT EXISTS idx_court_sessions_started_at ON court_sessions(started_at);

-- Row Level Security
ALTER TABLE court_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read court sessions" ON court_sessions
    FOR SELECT USING (true);

CREATE POLICY "Only admins can manage court sessions" ON court_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

-- Function to auto-start court session
CREATE OR REPLACE FUNCTION auto_start_court_session(authority_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    -- Only start if status is 'waiting' (prevents double starts)
    UPDATE court_sessions
    SET
        status = 'live',
        started_by = authority_user_id,
        started_at = NOW(),
        updated_at = NOW()
    WHERE status = 'waiting';

    GET DIAGNOSTICS rows_affected = ROW_COUNT;

    -- Return true if court was started (rows affected > 0)
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current court session
CREATE OR REPLACE FUNCTION get_current_court_session()
RETURNS TABLE (
    id UUID,
    status court_status_enum,
    started_by UUID,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cs.id,
        cs.status,
        cs.started_by,
        cs.started_at,
        cs.ended_at
    FROM court_sessions cs
    WHERE cs.status IN ('waiting', 'live')
    ORDER BY cs.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_court_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_court_session_updated_at
    BEFORE UPDATE ON court_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_court_session_updated_at();

-- Insert initial waiting session if none exists
INSERT INTO court_sessions (status)
SELECT 'waiting'
WHERE NOT EXISTS (SELECT 1 FROM court_sessions WHERE status IN ('waiting', 'live'));