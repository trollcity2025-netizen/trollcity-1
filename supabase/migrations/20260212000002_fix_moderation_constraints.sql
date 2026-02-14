
-- Migration: Fix Moderation Constraints
-- This migration ensures the moderation_actions and moderation_reports tables have the correct status constraints.

-- 1. Fix moderation_actions status check
ALTER TABLE public.moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_status_check;

-- Ensure the status column is TEXT and has no stray constraints
ALTER TABLE public.moderation_actions ALTER COLUMN status TYPE TEXT;

ALTER TABLE public.moderation_actions
ADD CONSTRAINT moderation_actions_status_check
CHECK (status IN ('active', 'expired', 'revoked', 'appealed', 'pending', 'reviewed', 'resolved', 'rejected'));

-- 2. Ensure the status and error_message columns exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'moderation_actions' AND column_name = 'status') THEN
        ALTER TABLE public.moderation_actions ADD COLUMN status TEXT DEFAULT 'active';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'moderation_actions' AND column_name = 'error_message') THEN
        ALTER TABLE public.moderation_actions ADD COLUMN error_message TEXT;
    END IF;
END $$;

-- 3. Fix moderation_reports status check
ALTER TABLE public.moderation_reports DROP CONSTRAINT IF EXISTS moderation_reports_status_check;

ALTER TABLE public.moderation_reports
ADD CONSTRAINT moderation_reports_status_check
CHECK (status IN ('pending', 'reviewed', 'resolved', 'rejected'));

-- 4. Update any existing NULL statuses in moderation_actions to 'active' if they are recent bans
UPDATE public.moderation_actions
SET status = 'active'
WHERE status IS NULL
  AND action_type = 'ban_user'
  AND (ban_expires_at IS NULL OR ban_expires_at > NOW());
