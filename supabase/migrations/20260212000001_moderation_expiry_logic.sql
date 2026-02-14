
-- Migration: Moderation Expiration Logic
-- This migration adds a function to process expired moderation actions and unban users whose bans have ended.
-- It also schedules this function to run every 10 minutes using pg_cron.

-- 1. Create the processing function
CREATE OR REPLACE FUNCTION public.process_expired_moderation_actions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    expired_count integer;
    unbanned_count integer;
BEGIN
    -- A) Update expired moderation actions to 'expired' status
    -- We target actions that are 'active', are of type 'ban_user' or 'suspend_stream', 
    -- and have an expiry time in the past.
    WITH expired_actions AS (
        UPDATE public.moderation_actions
        SET status = 'expired'
        WHERE status = 'active'
          AND (action_type = 'ban_user' OR action_type = 'suspend_stream')
          AND (ban_expires_at IS NOT NULL AND ban_expires_at < NOW())
        RETURNING id
    )
    SELECT count(*) INTO expired_count FROM expired_actions;

    -- B) For users who were banned, check if they have any remaining 'active' bans.
    -- If not, update their user_profile to set is_banned = false.
    WITH unbanned_users AS (
        UPDATE public.user_profiles up
        SET is_banned = false,
            ban_expires_at = NULL,
            updated_at = NOW()
        WHERE is_banned = true
          AND NOT EXISTS (
              SELECT 1 FROM public.moderation_actions ma
              WHERE ma.target_user_id = up.id
                AND ma.action_type = 'ban_user'
                AND ma.status = 'active'
          )
        RETURNING id
    )
    SELECT count(*) INTO unbanned_count FROM unbanned_users;

    -- Optional: Log the results to audit_logs if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        INSERT INTO public.audit_logs (action, details)
        VALUES ('process_expired_moderation', jsonb_build_object(
            'expired_actions_count', expired_count,
            'unbanned_users_count', unbanned_count,
            'processed_at', NOW()
        ));
    END IF;
END;
$$;

-- 2. Grant permissions
GRANT EXECUTE ON FUNCTION public.process_expired_moderation_actions() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_expired_moderation_actions() TO authenticated;

-- 3. Schedule the function using pg_cron if available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Schedule to run every 10 minutes
        -- Check if already scheduled to avoid duplicates
        IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process_expired_moderation') THEN
            PERFORM cron.schedule('process_expired_moderation', '*/10 * * * *', 'SELECT public.process_expired_moderation_actions()');
        END IF;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if pg_cron is not set up or permission denied
    RAISE NOTICE 'Could not schedule cron job: %', SQLERRM;
END $$;
