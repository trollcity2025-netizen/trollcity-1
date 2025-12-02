-- Test the approve_broadcaster function to see if it works
-- Replace 'YOUR_APPLICATION_ID_HERE' with an actual application ID from your database

-- First, check if function exists
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'approve_broadcaster';

-- Check function parameters
SELECT 
  parameter_name,
  data_type,
  parameter_mode
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND specific_name = (
    SELECT specific_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name = 'approve_broadcaster'
    LIMIT 1
  )
ORDER BY ordinal_position;

-- Test with a real application ID (replace with actual ID)
-- SELECT approve_broadcaster('YOUR_APPLICATION_ID_HERE'::uuid);

-- Or check what applications exist
SELECT id, user_id, full_name, application_status
FROM broadcaster_applications
WHERE application_status = 'pending'
LIMIT 5;

