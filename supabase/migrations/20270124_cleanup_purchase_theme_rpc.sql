-- Migration: Cleanup purchase_broadcast_theme ambiguity
-- Drop the wrapper function that takes p_user_id
-- Ensure only the secure auth.uid() version remains

DROP FUNCTION IF EXISTS public.purchase_broadcast_theme(boolean, uuid, uuid);

-- Re-assert the correct function to be sure (optional, but good for idempotency)
-- We rely on the existing one being correct as seen in checks.
-- If we wanted to be 100% sure, we could recreate it here, but let's just drop the extra one first.
