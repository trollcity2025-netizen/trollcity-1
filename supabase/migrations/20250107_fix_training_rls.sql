-- Enable RLS on training tables
ALTER TABLE training_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE officer_training_sessions ENABLE ROW LEVEL SECURITY;

-- Training Scenarios Policies
-- Everyone (authenticated) can view scenarios
CREATE POLICY "Authenticated users can view training scenarios"
ON training_scenarios FOR SELECT
TO authenticated
USING (true);

-- Only admins/officers might need to manage them, but for now we just need read access for the simulator.

-- Officer Training Sessions Policies
-- Officers can insert their own sessions
CREATE POLICY "Users can insert their own training sessions"
ON officer_training_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = officer_id);

-- Officers can view their own sessions
CREATE POLICY "Users can view their own training sessions"
ON officer_training_sessions FOR SELECT
TO authenticated
USING (auth.uid() = officer_id);

-- Admins can view all sessions
CREATE POLICY "Admins can view all training sessions"
ON officer_training_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND (role = 'admin' OR troll_role = 'admin')
  )
);
