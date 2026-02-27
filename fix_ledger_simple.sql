-- Step 1: First just try to drop the view
DROP VIEW IF EXISTS ledger_recent;
DROP VIEW IF EXISTS ledger_recent;

-- Step 2: Create the view fresh
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

-- Step 3: Grant permissions
GRANT SELECT ON ledger_recent TO authenticated;
GRANT SELECT ON ledger_recent TO service_role;
GRANT SELECT ON ledger_recent TO anon;

-- Step 4: Create RLS policy (run each separately if needed)
DROP POLICY IF EXISTS "Allow read on ledger_recent" ON ledger_recent;
CREATE POLICY "Allow read on ledger_recent" ON ledger_recent FOR SELECT USING (true);
