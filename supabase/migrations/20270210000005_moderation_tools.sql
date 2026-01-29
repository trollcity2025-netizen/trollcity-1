-- Moderation Tools Migration

-- 1. Moderation Logs Table
CREATE TABLE IF NOT EXISTS public.moderation_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    moderator_id UUID REFERENCES public.user_profiles(id),
    target_user_id UUID REFERENCES public.user_profiles(id),
    action_type TEXT NOT NULL, -- 'kick', 'ban', 'mute', 'warning', 'delete_message', 'rollback'
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- for bans/mutes
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. AI Moderation Cache Table
CREATE TABLE IF NOT EXISTS public.ai_moderation_cache (
    text_hash TEXT PRIMARY KEY,
    toxicity_score FLOAT,
    is_flagged BOOLEAN,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Perform Moderation Action RPC
CREATE OR REPLACE FUNCTION public.perform_moderation_action(
    p_target_id UUID,
    p_action_type TEXT,
    p_reason TEXT,
    p_duration_minutes INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mod_id UUID := auth.uid();
    v_expires_at TIMESTAMPTZ;
    v_target_role TEXT;
BEGIN
    -- Check permissions (Admin, Officer, or Admin-for-Week)
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_mod_id 
        AND (
            role IN ('admin', 'troll_officer', 'lead_troll_officer') 
            OR id IN (SELECT user_id FROM public.admin_for_week_queue WHERE status = 'active')
            OR is_admin = true
        )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Prevent action against Admins (unless self?)
    SELECT role INTO v_target_role FROM public.user_profiles WHERE id = p_target_id;
    IF v_target_role = 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot moderate an Admin');
    END IF;

    IF p_duration_minutes IS NOT NULL THEN
        v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;
    END IF;

    -- Log action
    INSERT INTO public.moderation_logs (moderator_id, target_user_id, action_type, reason, expires_at)
    VALUES (v_mod_id, p_target_id, p_action_type, p_reason, v_expires_at);

    -- Execute Action Logic
    IF p_action_type = 'ban' THEN
        UPDATE public.user_profiles SET is_banned = true, ban_expires_at = v_expires_at WHERE id = p_target_id;
    ELSIF p_action_type = 'mute' THEN
         UPDATE public.user_profiles SET is_muted = true, mute_expires_at = v_expires_at WHERE id = p_target_id;
    ELSIF p_action_type = 'kick' THEN
        -- Logic to disconnect user (handled by client listening to 'kick' channel event)
        -- We can update a column 'force_disconnect_at' or just rely on realtime logs
        NULL; 
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Rollback Moderation Action RPC
CREATE OR REPLACE FUNCTION public.rollback_moderation_action(
    p_log_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log RECORD;
    v_mod_id UUID := auth.uid();
BEGIN
    -- Check permissions
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_mod_id 
        AND (role IN ('admin', 'lead_troll_officer') OR is_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT * INTO v_log FROM public.moderation_logs WHERE id = p_log_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Log not found');
    END IF;

    IF v_log.action_type = 'ban' THEN
        UPDATE public.user_profiles SET is_banned = false, ban_expires_at = NULL WHERE id = v_log.target_user_id;
    ELSIF v_log.action_type = 'mute' THEN
        UPDATE public.user_profiles SET is_muted = false, mute_expires_at = NULL WHERE id = v_log.target_user_id;
    END IF;
    
    INSERT INTO public.moderation_logs (moderator_id, target_user_id, action_type, reason, metadata)
    VALUES (v_mod_id, v_log.target_user_id, 'rollback', 'Rolled back action ' || p_log_id, jsonb_build_object('original_log_id', p_log_id));

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Get Recent Moderation Logs
CREATE OR REPLACE FUNCTION public.get_moderation_logs(limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
    id UUID,
    moderator_username TEXT,
    target_username TEXT,
    action_type TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        l.id,
        m.username as moderator_username,
        t.username as target_username,
        l.action_type,
        l.reason,
        l.created_at,
        l.expires_at
    FROM public.moderation_logs l
    LEFT JOIN public.user_profiles m ON l.moderator_id = m.id
    LEFT JOIN public.user_profiles t ON l.target_user_id = t.id
    ORDER BY l.created_at DESC
    LIMIT limit_count;
$$;
