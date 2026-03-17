-- Family Call Minutes Table
-- Tracks call minutes purchased by family leaders for all family members

CREATE TABLE IF NOT EXISTS public.family_call_minutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    audio_minutes INTEGER NOT NULL DEFAULT 0,
    video_minutes INTEGER NOT NULL DEFAULT 0,
    purchased_by UUID NOT NULL REFERENCES auth.users(id),
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups by family
CREATE INDEX IF NOT EXISTS idx_family_call_minutes_family ON public.family_call_minutes(family_id);

-- Enable RLS
ALTER TABLE public.family_call_minutes ENABLE ROW LEVEL SECURITY;

-- Policy: Family leaders can view and manage family minutes
CREATE POLICY "Family leaders can view call minutes" 
    ON public.family_call_minutes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members 
            WHERE family_id = family_call_minutes.family_id 
            AND user_id = auth.uid()
            AND role IN ('leader', 'co_leader')
        )
        OR
        EXISTS (
            SELECT 1 FROM public.troll_family_members 
            WHERE family_id = family_call_minutes.family_id 
            AND user_id = auth.uid()
            AND role IN ('leader', 'co_leader')
        )
    );

-- Policy: Only leaders can purchase minutes
CREATE POLICY "Family leaders can insert call minutes" 
    ON public.family_call_minutes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.family_members 
            WHERE family_id = family_call_minutes.family_id 
            AND user_id = auth.uid()
            AND role IN ('leader', 'co_leader')
        )
        OR
        EXISTS (
            SELECT 1 FROM public.troll_family_members 
            WHERE family_id = family_call_minutes.family_id 
            AND user_id = auth.uid()
            AND role IN ('leader', 'co_leader')
        )
    );

-- Policy: Only leaders can update minutes
CREATE POLICY "Family leaders can update call minutes" 
    ON public.family_call_minutes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members 
            WHERE family_id = family_call_minutes.family_id 
            AND user_id = auth.uid()
            AND role IN ('leader', 'co_leader')
        )
        OR
        EXISTS (
            SELECT 1 FROM public.troll_family_members 
            WHERE family_id = family_call_minutes.family_id 
            AND user_id = auth.uid()
            AND role IN ('leader', 'co_leader')
        )
    );

-- Function to get family's available call minutes
CREATE OR REPLACE FUNCTION public.get_family_call_minutes(p_family_id UUID)
RETURNS TABLE (
    audio_minutes INTEGER,
    video_minutes INTEGER,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(fcm.audio_minutes, 0)::INTEGER as audio_minutes,
        COALESCE(fcm.video_minutes, 0)::INTEGER as video_minutes,
        fcm.expires_at
    FROM public.family_call_minutes fcm
    WHERE fcm.family_id = p_family_id
    AND (fcm.expires_at IS NULL OR fcm.expires_at > NOW())
    ORDER BY fcm.purchased_at DESC
    LIMIT 1;
END;
$$;

-- Function to purchase family call minutes
CREATE OR REPLACE FUNCTION public.purchase_family_call_minutes(
    p_family_id UUID,
    p_user_id UUID,
    p_audio_minutes INTEGER,
    p_video_minutes INTEGER,
    p_cost INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_count INTEGER;
BEGIN
    -- Check if user is a leader
    IF NOT EXISTS (
        SELECT 1 FROM public.family_members 
        WHERE family_id = p_family_id AND user_id = p_user_id AND role IN ('leader', 'co_leader')
    ) AND NOT EXISTS (
        SELECT 1 FROM public.troll_family_members 
        WHERE family_id = p_family_id AND user_id = p_user_id AND role IN ('leader', 'co_leader')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only family leaders can purchase call minutes');
    END IF;

    -- Check if family already has minutes
    SELECT COUNT(*) INTO v_existing_count
    FROM public.family_call_minutes
    WHERE family_id = p_family_id;

    IF v_existing_count > 0 THEN
        -- Add to existing
        INSERT INTO public.family_call_minutes (
            family_id,
            audio_minutes,
            video_minutes,
            purchased_by,
            expires_at
        )
        SELECT 
            p_family_id,
            COALESCE(MAX(audio_minutes), 0) + COALESCE(p_audio_minutes, 0),
            COALESCE(MAX(video_minutes), 0) + COALESCE(p_video_minutes, 0),
            p_user_id,
            NOW() + INTERVAL '30 days'
        FROM public.family_call_minutes
        WHERE family_id = p_family_id
        GROUP BY family_id;
    ELSE
        -- Insert fresh
        INSERT INTO public.family_call_minutes (
            family_id,
            audio_minutes,
            video_minutes,
            purchased_by,
            expires_at
        ) VALUES (
            p_family_id,
            COALESCE(p_audio_minutes, 0),
            COALESCE(p_video_minutes, 0),
            p_user_id,
            NOW() + INTERVAL '30 days'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'audio_minutes', COALESCE(p_audio_minutes, 0),
        'video_minutes', COALESCE(p_video_minutes, 0),
        'total_cost', p_cost
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_family_call_minutes(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_family_call_minutes(UUID, UUID, INTEGER, INTEGER, INTEGER) TO authenticated;

SELECT 'Family call minutes tables and functions created successfully!' as result;
