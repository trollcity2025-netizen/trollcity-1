-- Migration: Admin Queue Logic

CREATE OR REPLACE FUNCTION public.process_admin_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_admin RECORD;
    v_next_admin RECORD;
BEGIN
    -- 1. Check current active admin
    SELECT * INTO v_current_admin 
    FROM public.admin_for_week_queue 
    WHERE status = 'active' 
    ORDER BY started_at DESC 
    LIMIT 1;

    IF v_current_admin.id IS NOT NULL THEN
        -- Check if time is up
        IF v_current_admin.ended_at < NOW() THEN
            -- Mark completed
            UPDATE public.admin_for_week_queue 
            SET status = 'completed' 
            WHERE id = v_current_admin.id;
            
            -- Revoke Admin Role (Revert to citizen or previous role? Assuming citizen for safety)
            -- Ideally we should store previous role. For now, citizen.
            UPDATE public.user_profiles 
            SET role = 'citizen', is_admin = false 
            WHERE id = v_current_admin.user_id;
            
            -- Log
            INSERT INTO public.moderation_actions_log (action_type, target_user_id, reason)
            VALUES ('system_revoke_admin', v_current_admin.user_id, 'Admin for a Week expired');
        ELSE
            -- Still active, do nothing
            RETURN;
        END IF;
    END IF;

    -- 2. If we are here, there is no active admin (or we just removed one).
    -- Promote next in queue
    SELECT * INTO v_next_admin 
    FROM public.admin_for_week_queue 
    WHERE status = 'queued' 
    ORDER BY created_at ASC 
    LIMIT 1;

    IF v_next_admin.id IS NOT NULL THEN
        -- Activate
        UPDATE public.admin_for_week_queue 
        SET status = 'active', 
            started_at = NOW(), 
            ended_at = NOW() + INTERVAL '7 days' 
        WHERE id = v_next_admin.id;

        -- Grant Admin Role
        UPDATE public.user_profiles 
        SET role = 'admin', is_admin = true 
        WHERE id = v_next_admin.user_id;

        -- Log
        INSERT INTO public.moderation_actions_log (action_type, target_user_id, reason)
        VALUES ('system_grant_admin', v_next_admin.user_id, 'Admin for a Week started');
    END IF;
END;
$$;
