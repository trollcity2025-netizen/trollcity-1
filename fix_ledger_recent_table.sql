-- Fix ledger_recent - drop any existing object and recreate as view
-- Run this in Supabase SQL Editor

-- 1. Drop in correct order (view first, then table)
DROP VIEW IF EXISTS ledger_recent CASCADE;
DROP MATERIALIZED VIEW IF EXISTS ledger_recent CASCADE;
DROP TABLE IF EXISTS ledger_recent CASCADE;

-- 2. Create fresh as a VIEW
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
GRANT SELECT ON ledger_recent TO anon;

-- 4. Create RLS policy for the view
DROP POLICY IF EXISTS "Allow read on ledger_recent" ON ledger_recent;
CREATE POLICY "Allow read on ledger_recent" ON ledger_recent FOR SELECT USING (true);

-- 5. Verify it's now a view (not a table)
SELECT 
    table_name, 
    table_type 
FROM information_schema.tables 
WHERE table_name = 'ledger_recent';

-- Expected output should show VIEW, not BASE TABLE
