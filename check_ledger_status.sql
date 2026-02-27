-- Final check: Verify ledger_recent status
-- Run this in Supabase SQL Editor

-- 1. Check if ledger_recent exists and what type it is
SELECT 
    'ledger_recent' as object_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'ledger_recent') THEN 'VIEW'
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ledger_recent' AND table_type = 'BASE TABLE') THEN 'TABLE'
        WHEN EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'ledger_recent') THEN 'MATERIALIZED VIEW'
        ELSE 'NOT FOUND'
    END as object_type;

-- 2. Check RLS policies on ledger_recent
SELECT 
    policyname, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE tablename = 'ledger_recent';

-- 3. Check permissions
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.table_privileges 
WHERE table_name = 'ledger_recent';

-- 4. Try a simple SELECT to verify it works
SELECT 'Testing SELECT on ledger_recent:' as test, COUNT(*) as row_count 
FROM ledger_recent;
