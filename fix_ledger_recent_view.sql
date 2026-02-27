-- Fix ledger_recent view
-- This script properly creates the ledger_recent view

-- 1. Drop any existing object named ledger_recent (table, view, etc)
DROP TABLE IF EXISTS ledger_recent CASCADE;
DROP VIEW IF EXISTS ledger_recent CASCADE;

-- 2. Create the view fresh
CREATE VIEW ledger_recent AS
SELECT 
    ct.id,
    ct.user_id,
    up.username,
    ct.type,
    ct.amount,
    ct.coin_type,
    ct.description,
    ct.created_at
FROM coin_transactions ct
LEFT JOIN user_profiles up ON up.id = ct.user_id
ORDER BY ct.created_at DESC
LIMIT 100;

-- 3. Grant permissions
GRANT SELECT ON ledger_recent TO authenticated;
GRANT SELECT ON ledger_recent TO service_role;

-- 4. Create RLS policy (if RLS is enabled)
DROP POLICY IF EXISTS "Allow read on ledger_recent" ON ledger_recent;
CREATE POLICY "Allow read on ledger_recent" ON ledger_recent FOR SELECT USING (true);

-- 5. Verify the view exists
SELECT 'ledger_recent view created successfully' AS status;
