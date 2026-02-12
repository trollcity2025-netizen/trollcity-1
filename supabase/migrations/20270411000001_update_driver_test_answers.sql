-- Update driver test answer key
CREATE OR REPLACE FUNCTION public.submit_driver_test(
    answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_score INTEGER := 0;
    v_passed BOOLEAN := FALSE;
    v_correct_answers JSONB := '{
        "1": "A",
        "2": "B",
        "3": "B",
        "4": "C",
        "5": "A",
        "6": "D",
        "7": "C",
        "8": "A",
        "9": "B",
        "10": "B"
    }'::jsonb;
    v_key TEXT;
    v_ans TEXT;
    v_expiry TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    -- Grade the test
    FOR v_key IN SELECT jsonb_object_keys(v_correct_answers)
    LOOP
        v_ans := answers ->> v_key;
        IF v_ans = (v_correct_answers ->> v_key) THEN
            v_score := v_score + 1;
        END IF;
    END LOOP;

    -- Pass threshold: 8/10
    IF v_score >= 8 THEN
        v_passed := TRUE;
        v_expiry := NOW() + INTERVAL '30 days';

        -- Update/Insert License Table
        INSERT INTO public.user_driver_licenses (user_id, status, suspended_until, points, issued_at, updated_at)
        VALUES (v_user_id, 'valid', NULL, 0, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            status = 'valid',
            suspended_until = NULL,
            updated_at = NOW();

        -- Update User Profile (Denormalized fields for UI convenience)
        UPDATE public.user_profiles
        SET
            drivers_license_status = 'active',
            drivers_license_expiry = v_expiry
        WHERE id = v_user_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'passed', v_passed,
        'score', v_score
    );
END;
$$;
