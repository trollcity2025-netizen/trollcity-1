-- Fix the ambiguous send_gift function by dropping the duplicate
-- This resolves the "Could not choose the best candidate function" error

-- First, check which functions exist
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'send_gift';

-- Drop the function with bigint parameter (keep integer version)
-- This assumes the standard version uses integer for quantity
DROP FUNCTION IF EXISTS public.send_gift(
    p_stream_id uuid, 
    p_recipient_id uuid, 
    p_gift_id uuid, 
    p_quantity bigint
);

-- Verify only one function remains
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'send_gift';

-- Alternative: If you want to keep both but make them distinct, 
-- you can rename one:
-- ALTER FUNCTION public.send_gift(uuid, uuid, uuid, bigint) 
-- RENAME TO send_gift_bigint;
