-- Fix court sessions RLS policy to allow admins and lead officers
DROP POLICY IF EXISTS "Only admins can manage court sessions" ON court_sessions;

CREATE POLICY "Only admins and lead officers can manage court sessions" ON court_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true OR is_lead_officer = true)
        )
    );