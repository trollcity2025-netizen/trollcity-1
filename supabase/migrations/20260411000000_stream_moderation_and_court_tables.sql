-- Migration: Add stream moderation and court docket tables
-- Date: 2026-04-11

-- Add missing columns to stream_mutes if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_mutes' AND column_name = 'muted_by') THEN
        ALTER TABLE stream_mutes ADD COLUMN muted_by UUID REFERENCES user_profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_mutes' AND column_name = 'expires_at') THEN
        ALTER TABLE stream_mutes ADD COLUMN expires_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stream_mutes' AND column_name = 'reason') THEN
        ALTER TABLE stream_mutes ADD COLUMN reason TEXT;
    END IF;
END $$;

-- Table: chat_blocks (for disabling chat)
CREATE TABLE IF NOT EXISTS chat_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    blocked_by UUID REFERENCES user_profiles(id),
    expires_at TIMESTAMPTZ NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: stream_kicks
CREATE TABLE IF NOT EXISTS stream_kicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    kicked_by UUID REFERENCES user_profiles(id),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: court_dockets (ensure it exists with required columns - uses court_date, not session_date)
CREATE TABLE IF NOT EXISTS court_dockets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_date DATE NOT NULL,
    max_cases INTEGER DEFAULT 20,
    cases_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'scheduled',
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'court_dockets_court_date_unique') THEN
        ALTER TABLE court_dockets ADD CONSTRAINT court_dockets_court_date_unique UNIQUE (court_date);
    END IF;
END $$;

-- Table: broadcast_restrictions (for restricting broadcasters after stream ends)
CREATE TABLE IF NOT EXISTS broadcast_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    restricted_by UUID REFERENCES user_profiles(id),
    reason TEXT,
    duration_minutes INTEGER NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE stream_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_kicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_dockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_restrictions ENABLE ROW LEVEL SECURITY;

-- Allow moderators/officers to manage mutes
CREATE POLICY " Officers can manage stream_mutes" ON stream_mutes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = COALESCE(
                (SELECT muted_by FROM stream_mutes WHERE id = current_setting('app.current_user_id')::uuid),
                current_setting('app.current_user_id')::uuid
            )
            AND (role IN ('admin', 'lead_troll_officer', 'troll_officer', 'secretary', 'prosecutor', 'attorney')
                 OR is_admin = true
                 OR is_troll_officer = true
                 OR is_lead_officer = true)
        )
    );

-- Allow read access for stream participants
CREATE POLICY "Stream participants can read stream_mutes" ON stream_mutes
    FOR SELECT
    USING (
        stream_id IN (
            SELECT id FROM streams WHERE user_id = current_setting('app.current_user_id')::uuid
            OR id IN (SELECT stream_id FROM stream_participants WHERE user_id = current_setting('app.current_user_id')::uuid)
        )
    );