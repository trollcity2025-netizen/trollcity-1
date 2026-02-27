-- ============================================================================
-- SUMMON USER TO COURT FIX
-- ============================================================================
-- Fixes: "malformed array literal" errors and function ambiguity
-- 
-- Changes:
-- 1. Drop all existing overloads of summon_user_to_court
-- 2. Create canonical function with TEXT[] parameter (not TEXT)
-- 3. Add defensive NULL handling for p_users_involved
-- 4. Add structured logging for summon creation
-- 5. Prepare for future uuid[] migration
-- ============================================================================

-- Step 1: Drop all existing overloads
DROP FUNCTION IF EXISTS public.summon_user_to_court(UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.summon_user_to_court(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.summon_user_to_court(UUID, TEXT);
DROP FUNCTION IF EXISTS public.summon_user_to_court(UUID, TEXT, TEXT[], UUID);

-- Step 2: Create the canonical function with TEXT[] parameter
CREATE OR REPLACE FUNCTION public.summon_user_to_court(
    p_defendant_id UUID,
    p_reason TEXT,
    p_users_involved TEXT[] DEFAULT ARRAY[]::text[],
    p_docket_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_docket_id UUID;
    v_case_id UUID;
    v_staff_id UUID;
    v_case_count INTEGER;
    v_selected_date DATE;
    v_selected_max_cases INTEGER;
    v_users_involved_count INTEGER;
    v_log_message TEXT;
BEGIN
    v_staff_id := auth.uid();

    -- =========================================================================
    -- AUTHORIZATION CHECK
    -- =========================================================================
    IF v_staff_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: No authenticated user');
    END IF;

    -- Verify authorized staff role.
    IF NOT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE id = v_staff_id
            AND (
                role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge', 'secretary')
                OR is_admin = true
                OR is_troll_officer = true
                OR is_lead_officer = true
            )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Insufficient permissions');
    END IF;

    -- =========================================================================
    -- DEFENSIVE NULL HANDLING FOR p_users_involved
    -- =========================================================================
    -- This prevents "malformed array literal" errors when frontend sends 
    -- unexpected values or NULL
    IF p_users_involved IS NULL THEN
        p_users_involved := ARRAY[]::text[];
    END IF;

    -- Get count for logging
    v_users_involved_count := array_length(p_users_involved, 1);
    IF v_users_involved_count IS NULL THEN
        v_users_involved_count := 0;
    END IF;

    -- =========================================================================
    -- DOCKET RESOLUTION
    -- =========================================================================
    IF p_docket_id IS NOT NULL THEN
        SELECT court_date, COALESCE(max_cases, 20)
        INTO v_selected_date, v_selected_max_cases
        FROM public.court_dockets
        WHERE id = p_docket_id;

        IF v_selected_date IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Selected docket not found');
        END IF;

        SELECT COUNT(*)
        INTO v_case_count
        FROM public.court_cases
        WHERE docket_id = p_docket_id;

        IF v_case_count >= v_selected_max_cases THEN
            UPDATE public.court_dockets SET status = 'full' WHERE id = p_docket_id;
            v_docket_id := public.get_or_create_next_docket(v_selected_date + 4);
        ELSE
            v_docket_id := p_docket_id;
        END IF;
    ELSE
        v_docket_id := public.get_or_create_next_docket(CURRENT_DATE);
    END IF;

    -- =========================================================================
    -- CREATE COURT CASE
    -- =========================================================================
    -- Store users_involved as text[] array directly
    INSERT INTO public.court_cases (
        docket_id,
        defendant_id,
        plaintiff_id,
        reason,
        users_involved,
        status,
        warrant_active
    )
    VALUES (
        v_docket_id,
        p_defendant_id,
        v_staff_id,
        p_reason,
        p_users_involved,
        'pending',
        false
    )
    RETURNING id INTO v_case_id;

    -- =========================================================================
    -- UPDATE DOCKET STATUS IF FULL
    -- =========================================================================
    SELECT COUNT(*)
    INTO v_case_count
    FROM public.court_cases
    WHERE docket_id = v_docket_id;

    IF v_case_count >= (
        SELECT COALESCE(max_cases, 20)
        FROM public.court_dockets
        WHERE id = v_docket_id
    ) THEN
        UPDATE public.court_dockets
        SET status = 'full'
        WHERE id = v_docket_id;
    END IF;

    -- =========================================================================
    -- STRUCTURED LOGGING
    -- =========================================================================
    -- Log summon creation for audit trail
    v_log_message := format(
        'SUMMON_CREATED: defendant_id=%s, docket_id=%s, officer_id=%s, users_involved_count=%s, timestamp=%s',
        p_defendant_id,
        v_docket_id,
        v_staff_id,
        v_users_involved_count,
        now()
    );
    
    -- Insert into audit log table if it exists
    -- This is a best-effort logging - won't fail the transaction if table doesn't exist
    BEGIN
        INSERT INTO public.court_summons_log (defendant_id, docket_id, officer_id, users_involved, created_at)
        VALUES (p_defendant_id, v_docket_id, v_staff_id, p_users_involved, now());
    EXCEPTION WHEN undefined_table THEN
        -- Log to notification system as fallback
        PERFORM pg_notify('summon_created', v_log_message);
    END;

    -- =========================================================================
    -- SEND NOTIFICATIONS FOR COURT DATE
    -- =========================================================================
    -- Notify the defendant (user being summoned)
    PERFORM public.create_notification(
        p_defendant_id,
        'moderation_action',
        'Court Summons Issued',
        format('You have been summoned to Troll Court on %s. Reason: %s', 
            (SELECT court_date FROM public.court_dockets WHERE id = v_docket_id),
            p_reason
        ),
        jsonb_build_object(
            'docket_id', v_docket_id,
            'case_id', v_case_id,
            'court_date', (SELECT court_date FROM public.court_dockets WHERE id = v_docket_id),
            'reason', p_reason,
            'action_url', '/troll-court'
        )
    );

    -- Notify the staff member (who summoned the user)
    PERFORM public.create_notification(
        v_staff_id,
        'moderation_action',
        'Court Summons Created',
        format('You have summoned %s to Troll Court on %s', 
            p_defendant_id::text,
            (SELECT court_date FROM public.court_dockets WHERE id = v_docket_id)
        ),
        jsonb_build_object(
            'docket_id', v_docket_id,
            'case_id', v_case_id,
            'court_date', (SELECT court_date FROM public.court_dockets WHERE id = v_docket_id),
            'defendant_id', p_defendant_id,
            'reason', p_reason,
            'action_url', '/troll-court'
        )
    );

    -- =========================================================================
    -- RETURN SUCCESS
    -- =========================================================================
    RETURN jsonb_build_object(
        'success', true,
        'case_id', v_case_id,
        'docket_id', v_docket_id,
        'court_date', (SELECT court_date FROM public.court_dockets WHERE id = v_docket_id),
        'max_cases', (SELECT COALESCE(max_cases, 20) FROM public.court_dockets WHERE id = v_docket_id),
        'users_involved_count', v_users_involved_count
    );

EXCEPTION WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE LOG 'SUMMON_ERROR: %', SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.summon_user_to_court(UUID, TEXT, TEXT[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.summon_user_to_court(UUID, TEXT, TEXT[], UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.summon_user_to_court(UUID, TEXT, TEXT[], UUID) TO service_role;

-- ============================================================================
-- FUTURE MIGRATION PATH NOTE
-- ============================================================================
-- TODO: Future migration to UUID[] for p_users_involved:
-- When Troll City entities are fully ID-based, this function should be 
-- updated to use UUID[] instead of TEXT[]. This will require:
-- 1. Creating new function overload: summon_user_to_court(UUID, TEXT, UUID[], UUID)
-- 2. Updating frontend to pass UUID arrays
-- 3. Updating court_cases.users_involved column to store UUIDs
-- 
-- Example migration:
-- CREATE OR REPLACE FUNCTION public.summon_user_to_court(
--     p_defendant_id UUID,
--     p_reason TEXT,
--     p_users_involved UUID[] DEFAULT ARRAY[]::uuid[],
--     p_docket_id UUID DEFAULT NULL
-- )
-- ============================================================================

-- Create audit log table if it doesn't exist (for structured logging)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'court_summons_log'
    ) THEN
        CREATE TABLE public.court_summons_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            defendant_id UUID NOT NULL,
            docket_id UUID NOT NULL,
            officer_id UUID NOT NULL,
            users_involved TEXT[],
            created_at TIMESTAMPTZ DEFAULT now()
        );
        
        -- Grant permissions
        GRANT SELECT ON public.court_summons_log TO authenticated;
        GRANT SELECT ON public.court_summons_log TO anon;
        
        -- Create index for querying
        CREATE INDEX idx_court_summons_log_defendant ON public.court_summons_log(defendant_id);
        CREATE INDEX idx_court_summons_log_officer ON public.court_summons_log(officer_id);
        CREATE INDEX idx_court_summons_log_created ON public.court_summons_log(created_at DESC);
        
        RAISE NOTICE 'Created court_summons_log table for audit trail';
    END IF;
END $$;
