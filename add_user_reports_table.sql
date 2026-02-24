-- Create user_reports table for broadcast moderation
CREATE TABLE IF NOT EXISTS user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    reported_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    reviewed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert a report
CREATE POLICY "Anyone can create reports" ON user_reports
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Allow officers to view all reports
CREATE POLICY "Officers can view reports" ON user_reports
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'moderator', 'troll_officer')
        )
    );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported_user ON user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_created ON user_reports(created_at DESC);
