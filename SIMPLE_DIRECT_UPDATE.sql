-- Alternative: Use direct UPDATE instead of RPC function
-- This is simpler and doesn't require function creation
-- You can use this in your frontend code instead

-- Example for Approve:
-- UPDATE broadcaster_applications
-- SET 
--   application_status = 'approved',
--   reviewed_by = auth.uid(),
--   reviewed_at = NOW(),
--   updated_at = NOW()
-- WHERE id = 'APPLICATION_ID_HERE';

-- Example for Reject:
-- UPDATE broadcaster_applications
-- SET 
--   application_status = 'rejected',
--   reviewed_by = auth.uid(),
--   reviewed_at = NOW(),
--   rejection_reason = 'REASON_HERE',
--   admin_notes = 'NOTES_HERE',
--   updated_at = NOW()
-- WHERE id = 'APPLICATION_ID_HERE';

-- But you still need to:
-- 1. Update user_profiles to set is_broadcaster = true (for approve)
-- 2. Send notifications
-- That's why the RPC function is better - it does all of this automatically

