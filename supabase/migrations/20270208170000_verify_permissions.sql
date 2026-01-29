-- Migration: Verify RLS Permissions for Secretary and Unified View

-- 1. Ensure Secretary Access on Payout Runs (if not covered by generic admin policy)
-- Note: The previous migration added policies checking for (role = 'secretary').
-- We will just ensure the role column exists and is used correctly.

-- 2. Explicitly Grant Select on Tables to Authenticated (needed for RLS to even trigger)
GRANT SELECT ON TABLE payout_runs TO authenticated;
GRANT SELECT ON TABLE payouts TO authenticated;

-- 3. Ensure View Permissions
GRANT SELECT ON TABLE payout_history_view TO authenticated;
GRANT SELECT ON TABLE payout_history_view TO service_role;

-- 4. Add a policy for Secretaries specifically if the generic one fails (optional, but good for safety)
-- We'll drop if exists to avoid conflict, then recreate
DROP POLICY IF EXISTS "Secretaries view payout runs" ON payout_runs;
CREATE POLICY "Secretaries view payout runs" ON payout_runs
FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'secretary')
);

DROP POLICY IF EXISTS "Secretaries view payouts" ON payouts;
CREATE POLICY "Secretaries view payouts" ON payouts
FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'secretary')
);
