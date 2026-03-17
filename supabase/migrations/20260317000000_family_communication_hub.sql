-- =============================================================================
-- FAMILY COMMUNICATION HUB - DATABASE TABLES
-- Creates tables for real-time chat, voice calls, and video calls
-- =============================================================================

-- 1. Family Chat Messages Table
CREATE TABLE IF NOT EXISTS public.family_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'call')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 2. Family Calls Table
CREATE TABLE IF NOT EXISTS public.family_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'voice' CHECK (type IN ('voice', 'video')),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    max_participants INTEGER DEFAULT 8,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- 3. Family Call Members Table (who's in the call)
CREATE TABLE IF NOT EXISTS public.family_call_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES public.family_calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    is_speaking BOOLEAN DEFAULT false,
    is_muted BOOLEAN DEFAULT false,
    is_video_on BOOLEAN DEFAULT false,
    
    -- Unique constraint: user can only be in one active call at a time per family
    UNIQUE(call_id, user_id)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Index for fetching messages by family (with pagination)
CREATE INDEX IF NOT EXISTS idx_family_chat_messages_family 
    ON public.family_chat_messages(family_id, created_at DESC);

-- Index for fetching active calls by family
CREATE INDEX IF NOT EXISTS idx_family_calls_active 
    ON public.family_calls(family_id, is_active) WHERE is_active = true;

-- Index for fetching call members
CREATE INDEX IF NOT EXISTS idx_family_call_members_call 
    ON public.family_call_members(call_id, joined_at);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.family_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_call_members ENABLE ROW LEVEL SECURITY;

-- Family chat messages: any family member can read/write
CREATE POLICY "Family members can read chat messages" 
    ON public.family_chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members 
            WHERE family_id = family_chat_messages.family_id 
            AND user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.troll_family_members 
            WHERE family_id = family_chat_messages.family_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Family members can insert chat messages" 
    ON public.family_chat_messages FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM public.family_members 
                WHERE family_id = family_chat_messages.family_id 
                AND user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM public.troll_family_members 
                WHERE family_id = family_chat_messages.family_id 
                AND user_id = auth.uid()
            )
        )
    );

-- Family calls: any family member can read/write
CREATE POLICY "Family members can read calls" 
    ON public.family_calls FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members 
            WHERE family_id = family_calls.family_id 
            AND user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.troll_family_members 
            WHERE family_id = family_calls.family_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Family members can insert calls" 
    ON public.family_calls FOR INSERT
    WITH CHECK (
        created_by = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM public.family_members 
                WHERE family_id = family_calls.family_id 
                AND user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM public.troll_family_members 
                WHERE family_id = family_calls.family_id 
                AND user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Family members can update calls" 
    ON public.family_calls FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members 
            WHERE family_id = family_calls.family_id 
            AND user_id = auth.uid()
            AND role IN ('leader', 'co_leader')
        )
    );

-- Family call members: any family member can read/write
CREATE POLICY "Family members can read call members" 
    ON public.family_call_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.family_calls fc
            JOIN public.family_members fm ON fm.family_id = fc.family_id
            WHERE fc.id = family_call_members.call_id 
            AND fm.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.family_calls fc
            JOIN public.troll_family_members tfm ON tfm.family_id = fc.family_id
            WHERE fc.id = family_call_members.call_id 
            AND tfm.user_id = auth.uid()
        )
    );

CREATE POLICY "Family members can insert call members" 
    ON public.family_call_members FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
    );

CREATE POLICY "Family members can update call members" 
    ON public.family_call_members FOR UPDATE
    USING (
        user_id = auth.uid()
    );

-- =============================================================================
-- REALTIME SUBSCRIPTIONS
-- =============================================================================

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_call_members;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get family members with online status
CREATE OR REPLACE FUNCTION public.get_family_online_members(p_family_id UUID)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    display_name TEXT,
    avatar_url TEXT,
    role TEXT,
    is_in_call BOOLEAN,
    call_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fm.user_id,
        COALESCE(up.username, 'Unknown')::TEXT,
        COALESCE(up.username, 'Unknown')::TEXT,
        COALESCE(up.avatar_url, '')::TEXT,
        fm.role,
        CASE WHEN fcm.call_id IS NOT NULL THEN true ELSE false END as is_in_call,
        fcm.call_id
    FROM public.family_members fm
    LEFT JOIN public.user_profiles up ON up.id = fm.user_id
    LEFT JOIN LATERAL (
        SELECT fcm2.call_id 
        FROM public.family_call_members fcm2
        JOIN public.family_calls fc2 ON fc2.id = fcm2.call_id
        WHERE fcm2.user_id = fm.user_id 
        AND fcm2.left_at IS NULL
        AND fc2.is_active = true
        LIMIT 1
    ) fcm ON true
    WHERE fm.family_id = p_family_id
    ORDER BY 
        CASE fm.role 
            WHEN 'leader' THEN 1 
            WHEN 'co_leader' THEN 2 
            ELSE 3 
        END,
        up.username NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start a family call
CREATE OR REPLACE FUNCTION public.start_family_call(
    p_family_id UUID,
    p_user_id UUID,
    p_call_type TEXT DEFAULT 'voice'
)
RETURNS JSONB AS $$
DECLARE
    v_call_id UUID;
    v_username TEXT;
    v_result JSONB;
BEGIN
    -- Check if user is in family
    IF NOT EXISTS (
        SELECT 1 FROM public.family_members 
        WHERE family_id = p_family_id AND user_id = p_user_id
    ) AND NOT EXISTS (
        SELECT 1 FROM public.troll_family_members 
        WHERE family_id = p_family_id AND user_id = p_user_id
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You are not a member of this family'
        );
    END IF;

    -- Check if there's already an active call
    IF EXISTS (
        SELECT 1 FROM public.family_calls 
        WHERE family_id = p_family_id AND is_active = true
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'There is already an active call in this family'
        );
    END IF;

    -- Get username
    SELECT username INTO v_username FROM public.user_profiles WHERE id = p_user_id;

    -- Create the call
    INSERT INTO public.family_calls (family_id, type, created_by, is_active)
    VALUES (p_family_id, p_call_type, p_user_id, true)
    RETURNING id INTO v_call_id;

    -- Add creator to call members
    INSERT INTO public.family_call_members (call_id, user_id)
    VALUES (v_call_id, p_user_id);

    -- Add system message
    INSERT INTO public.family_chat_messages (family_id, user_id, message, message_type)
    VALUES (
        p_family_id, 
        p_user_id, 
        CASE 
            WHEN p_call_type = 'voice' THEN '🔊 ' || COALESCE(v_username, 'Someone') || ' started a voice call'
            ELSE '📹 ' || COALESCE(v_username, 'Someone') || ' started a video call'
        END,
        'call'
    );

    RETURN jsonb_build_object(
        'success', true,
        'call_id', v_call_id,
        'call_type', p_call_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to join a family call
CREATE OR REPLACE FUNCTION public.join_family_call(
    p_call_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_call RECORD;
    v_username TEXT;
    v_current_count INTEGER;
    v_result JSONB;
BEGIN
    -- Get call details
    SELECT fc.* INTO v_call FROM public.family_calls fc WHERE fc.id = p_call_id;

    IF v_call IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Call not found'
        );
    END IF;

    IF NOT v_call.is_active THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This call has ended'
        );
    END IF;

    -- Check if user is already in the call
    IF EXISTS (
        SELECT 1 FROM public.family_call_members 
        WHERE call_id = p_call_id AND user_id = p_user_id AND left_at IS NULL
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You are already in this call'
        );
    END IF;

    -- Check max participants
    SELECT COUNT(*) INTO v_current_count 
    FROM public.family_call_members 
    WHERE call_id = p_call_id AND left_at IS NULL;

    IF v_current_count >= v_call.max_participants THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Call is full'
        );
    END IF;

    -- Get username
    SELECT username INTO v_username FROM public.user_profiles WHERE id = p_user_id;

    -- Add user to call
    INSERT INTO public.family_call_members (call_id, user_id)
    VALUES (p_call_id, p_user_id);

    -- Add system message
    INSERT INTO public.family_chat_messages (family_id, user_id, message, message_type)
    VALUES (
        v_call.family_id, 
        p_user_id, 
        '👤 ' || COALESCE(v_username, 'Someone') || ' joined the call',
        'call'
    );

    RETURN jsonb_build_object(
        'success', true,
        'call_id', p_call_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to leave a family call
CREATE OR REPLACE FUNCTION public.leave_family_call(
    p_call_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_call RECORD;
    v_username TEXT;
    v_remaining_count INTEGER;
    v_result JSONB;
BEGIN
    -- Get call details
    SELECT fc.* INTO v_call FROM public.family_calls fc WHERE fc.id = p_call_id;

    IF v_call IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Call not found'
        );
    END IF;

    -- Get username
    SELECT username INTO v_username FROM public.user_profiles WHERE id = p_user_id;

    -- Mark user as left
    UPDATE public.family_call_members
    SET left_at = NOW()
    WHERE call_id = p_call_id AND user_id = p_user_id AND left_at IS NULL;

    -- Add system message
    INSERT INTO public.family_chat_messages (family_id, user_id, message, message_type)
    VALUES (
        v_call.family_id, 
        p_user_id, 
        '👋 ' || COALESCE(v_username, 'Someone') || ' left the call',
        'call'
    );

    -- Check remaining participants
    SELECT COUNT(*) INTO v_remaining_count 
    FROM public.family_call_members 
    WHERE call_id = p_call_id AND left_at IS NULL;

    -- If no one left, end the call
    IF v_remaining_count = 0 THEN
        UPDATE public.family_calls
        SET is_active = false, ended_at = NOW()
        WHERE id = p_call_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end a family call (for creator/leader)
CREATE OR REPLACE FUNCTION public.end_family_call(
    p_call_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_call RECORD;
    v_username TEXT;
BEGIN
    -- Get call details
    SELECT fc.* INTO v_call FROM public.family_calls fc WHERE fc.id = p_call_id;

    IF v_call IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Call not found'
        );
    END IF;

    -- Check permission (creator or leader)
    IF v_call.created_by != p_user_id THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.family_members 
            WHERE family_id = v_call.family_id 
            AND user_id = p_user_id 
            AND role IN ('leader', 'co_leader')
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Only the call creator or family leaders can end the call'
            );
        END IF;
    END IF;

    -- Get username
    SELECT username INTO v_username FROM public.user_profiles WHERE id = p_user_id;

    -- End the call
    UPDATE public.family_calls
    SET is_active = false, ended_at = NOW()
    WHERE id = p_call_id;

    -- Mark all members as left
    UPDATE public.family_call_members
    SET left_at = COALESCE(left_at, NOW())
    WHERE call_id = p_call_id AND left_at IS NULL;

    -- Add system message
    INSERT INTO public.family_chat_messages (family_id, user_id, message, message_type)
    VALUES (
        v_call.family_id, 
        p_user_id, 
        '📴 ' || COALESCE(v_username, 'Someone') || ' ended the call',
        'call'
    );

    RETURN jsonb_build_object(
        'success', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_family_online_members(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_family_call(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_family_call(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_family_call(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.end_family_call(UUID, UUID) TO authenticated, service_role;

SELECT 'Family Communication Hub tables created successfully!' as result;
