-- Fix: Ensure users_involved column is TEXT, not an array
-- This migration fixes the "malformed array literal" error when summoning users

-- First, check the current column type
DO $$ 
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type 
    FROM information_schema.columns 
    WHERE table_name = 'court_cases' AND column_name = 'users_involved';
    
    RAISE NOTICE 'Current users_involved column type: %', col_type;
    
    -- If it's an array type (character varying[] or text[]), convert it to text
    IF col_type LIKE '%[]%' THEN
        RAISE NOTICE 'Converting users_involved from array to text type';
        
        -- Alter column type to text
        ALTER TABLE court_cases 
        ALTER COLUMN users_involved TYPE TEXT USING users_involved::text;
    END IF;
END $$;

-- Also ensure the function parameter is properly handled
-- Recreate the function with explicit casting if needed
CREATE OR REPLACE FUNCTION public.summon_user_to_court(
    p_defendant_id UUID,
    p_reason TEXT,
    p_users_involved TEXT DEFAULT NULL,
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
BEGIN
    v_staff_id := auth.uid();

    IF v_staff_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
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
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Resolve docket.
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

    -- Create case on resolved docket.
    -- Explicitly cast p_users_involved to TEXT to ensure it's not treated as array
    INSERT INTO public.court_cases (
      docket_id,
      defendant_id,
      plaintiff_id,
      reason,
      users_involved
    )
    VALUES (
      v_docket_id,
      p_defendant_id,
      v_staff_id,
      p_reason,
      p_users_involved::TEXT
    )
    RETURNING id INTO v_case_id;

    -- Update docket status if now full.
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

    RETURN jsonb_build_object(
      'success', true,
      'case_id', v_case_id,
      'docket_id', v_docket_id,
      'court_date', (SELECT court_date FROM public.court_dockets WHERE id = v_docket_id),
      'max_cases', (SELECT COALESCE(max_cases, 20) FROM public.court_dockets WHERE id = v_docket_id)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.summon_user_to_court(UUID, TEXT, TEXT, UUID) TO authenticated;
