-- Migration: Enhance set_user_role and add admin_delete_user
-- 1. Update set_user_role to handle boolean flags
-- 2. Create admin_soft_delete_user

-- 1. Enhanced set_user_role
CREATE OR REPLACE FUNCTION public.set_user_role(
    target_user UUID,
    new_role TEXT,
    reason TEXT
) RETURNS VOID AS $$
DECLARE
    v_admin_id UUID;
    v_old_role TEXT;
BEGIN
    v_admin_id := auth.uid();
    
    -- Verify Admin
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_admin_id 
        AND (role = 'admin' OR is_admin = true)
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can change roles';
    END IF;

    -- Get old role
    SELECT role INTO v_old_role FROM public.user_profiles WHERE id = target_user;

    -- Update flags based on role
    UPDATE public.user_profiles
    SET 
        role = new_role,
        is_admin = (new_role = 'admin'),
        is_lead_officer = (new_role = 'lead_troll_officer'),
        is_troll_officer = (new_role IN ('troll_officer', 'lead_troll_officer')),
        is_troller = (new_role = 'troller'),
        updated_at = now()
    WHERE id = target_user;

    -- Log change
    INSERT INTO public.role_change_log (
        target_user,
        changed_by,
        old_role,
        new_role,
        reason,
        created_at
    ) VALUES (
        target_user,
        v_admin_id,
        v_old_role,
        new_role,
        reason,
        now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Soft Delete User (since we can't delete from auth.users easily from here)
CREATE OR REPLACE FUNCTION public.admin_soft_delete_user(
    p_user_id UUID,
    p_reason TEXT DEFAULT 'Admin deleted user'
) RETURNS VOID AS $$
DECLARE
    v_admin_id UUID;
BEGIN
    v_admin_id := auth.uid();

    -- Verify Admin
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_admin_id 
        AND (role = 'admin' OR is_admin = true)
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Mark as banned and wipe sensitive info (Soft Delete)
    UPDATE public.user_profiles
    SET 
        is_banned = true,
        banned_until = '2099-01-01 00:00:00+00',
        username = 'Deleted User ' || substring(id::text, 1, 8),
        avatar_url = null,
        bio = null,
        email = 'deleted_' || id || '@deleted.com' -- Obfuscate email if stored here
    WHERE id = p_user_id;

    -- Log it
    INSERT INTO public.moderation_logs (
        admin_id,
        target_user_id,
        action_type,
        reason
    ) VALUES (
        v_admin_id,
        p_user_id,
        'soft_delete',
        p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
