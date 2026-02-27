-- ============================================================================
-- Fix payout_dashboard view if missing or empty
-- ============================================================================

-- Step 1: Check if payout_dashboard view exists
SELECT 
    'Checking payout_dashboard view...' AS status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'payout_dashboard') 
        THEN 'EXISTS'
        ELSE 'MISSING'
    END AS view_status;

-- Step 2: Check payout_requests table exists
SELECT 
    'Checking payout_requests table...' AS status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_requests') 
        THEN 'EXISTS'
        ELSE 'MISSING'
    END AS table_status;

-- Step 3: Show columns in payout_requests
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payout_requests'
ORDER BY ordinal_position;

-- Step 4: Count rows in payout_requests
SELECT 
    'payout_requests row count:' AS test, 
    COUNT(*) AS count 
FROM payout_requests;

-- Step 5: Recreate payout_dashboard view if needed
DROP VIEW IF EXISTS payout_dashboard;

CREATE OR REPLACE VIEW payout_dashboard AS
SELECT 
    pr.id,
    pr.user_id,
    up.username,
    up.payout_paypal_email,
    pr.amount AS coins_requested,
    pr.cash_amount,
    pr.status,
    pr.created_at,
    pr.processed_at
FROM payout_requests pr
LEFT JOIN user_profiles up ON up.id = pr.user_id
ORDER BY pr.created_at DESC;

-- Step 6: Verify view works
SELECT 
    'payout_dashboard test:' AS test, 
    COUNT(*) AS count 
FROM payout_dashboard;
