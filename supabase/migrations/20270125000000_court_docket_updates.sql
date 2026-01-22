-- Migration: Create Docket and Case Management Functions

-- 1. Function to create a docket entry (case) and notify the user
-- This function handles:
--   a) Creating a docket for the date if it doesn't exist
--   b) Adding the case to the docket
--   c) Sending a notification to the defendant
CREATE OR REPLACE FUNCTION public.manage_court_case(
    p_defendant_id UUID,
    p_plaintiff_id UUID, -- The officer/admin creating the case
    p_reason TEXT,
    p_court_date DATE,
    p_status TEXT DEFAULT 'pending'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_docket_id UUID;
    v_case_id UUID;
    v_plaintiff_name TEXT;
    v_defendant_name TEXT;
BEGIN
    -- 1. Get or Create Docket for the date
    SELECT id INTO v_docket_id
    FROM public.court_dockets
    WHERE court_date = p_court_date;

    IF v_docket_id IS NULL THEN
        INSERT INTO public.court_dockets (court_date, status)
        VALUES (p_court_date, 'open')
        RETURNING id INTO v_docket_id;
    END IF;

    -- 2. Insert Case
    INSERT INTO public.court_cases (
        docket_id,
        defendant_id,
        plaintiff_id,
        reason,
        status,
        incident_date
    )
    VALUES (
        v_docket_id,
        p_defendant_id,
        p_plaintiff_id,
        p_reason,
        p_status,
        NOW()
    )
    RETURNING id INTO v_case_id;

    -- 3. Get names for notification
    SELECT username INTO v_plaintiff_name FROM public.user_profiles WHERE id = p_plaintiff_id;
    SELECT username INTO v_defendant_name FROM public.user_profiles WHERE id = p_defendant_id;

    -- 4. Create Notification
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        metadata
    )
    VALUES (
        p_defendant_id,
        'moderation_action', -- Using moderation_action type as it fits best
        'Court Summons Issued',
        format('You have been summoned to court on %s by %s. Reason: %s', p_court_date, v_plaintiff_name, p_reason),
        jsonb_build_object(
            'case_id', v_case_id,
            'docket_id', v_docket_id,
            'court_date', p_court_date,
            'action', 'court_summons'
        )
    );

    RETURN v_case_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.manage_court_case(UUID, UUID, TEXT, DATE, TEXT) TO authenticated;

-- Ensure RLS allows Admin/Secretary/Lead/Officer to use this
-- The function is SECURITY DEFINER so it bypasses RLS for the table operations inside, 
-- but we should ensure the caller is authorized in the frontend/API layer. 
-- However, we can add a check inside the function if needed, but the current design relies on App logic.
-- Let's add a basic role check for safety.

CREATE OR REPLACE FUNCTION public.manage_court_case_safe(
    p_defendant_id UUID,
    p_reason TEXT,
    p_court_date DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_id UUID;
    v_is_authorized BOOLEAN;
BEGIN
    v_caller_id := auth.uid();
    
    -- Check if caller is authorized (Admin, Officer, Lead, Secretary)
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_caller_id 
        AND (
            role IN ('admin', 'secretary', 'troll_officer', 'lead_troll_officer') 
            OR is_admin = true 
            OR is_troll_officer = true
            OR is_lead_officer = true
            OR troll_role IN ('admin', 'secretary', 'troll_officer', 'lead_troll_officer')
        )
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to create court cases.';
    END IF;

    -- Call the internal function
    RETURN public.manage_court_case(p_defendant_id, v_caller_id, p_reason, p_court_date);
END;
$$;

GRANT EXECUTE ON FUNCTION public.manage_court_case_safe(UUID, TEXT, DATE) TO authenticated;

-- Fix for Cover Photo Upload (Bucket Permissions)
-- Ensure 'covers' bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload to covers bucket
DROP POLICY IF EXISTS "Give users access to own folder 1ok12a_0" ON storage.objects;
CREATE POLICY "Give users access to own folder 1ok12a_0" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'covers');

DROP POLICY IF EXISTS "Give users access to own folder 1ok12a_1" ON storage.objects;
CREATE POLICY "Give users access to own folder 1ok12a_1" ON storage.objects FOR SELECT TO public USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "Give users access to own folder 1ok12a_2" ON storage.objects;
CREATE POLICY "Give users access to own folder 1ok12a_2" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "Give users access to own folder 1ok12a_3" ON storage.objects;
CREATE POLICY "Give users access to own folder 1ok12a_3" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'covers');

