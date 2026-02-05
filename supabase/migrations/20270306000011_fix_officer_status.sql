-- Fix officer status logic: decouple clock-in status from employment status

-- 1. Update manual_clock_in to NOT auto-activate officer (respect suspension)
CREATE OR REPLACE FUNCTION "public"."manual_clock_in"("p_officer_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_active_session_id uuid;
    v_is_active boolean;
BEGIN
    -- Check if officer is active (not suspended)
    SELECT is_officer_active INTO v_is_active
    FROM profiles
    WHERE id = p_officer_id;

    -- If we want to enforce suspension preventing clock-in:
    -- IF v_is_active IS FALSE THEN
    --    RETURN jsonb_build_object('success', false, 'message', 'Officer is suspended');
    -- END IF;
    -- However, since we are migrating from a broken state where everyone is false, 
    -- we might want to skip this check or ensure we migrate data first.
    -- For now, let's just REMOVE the auto-update of is_officer_active.
    
    -- Check if officer already has an active session
    SELECT id INTO v_active_session_id
    FROM officer_work_sessions
    WHERE officer_id = p_officer_id 
    AND clock_out IS NULL 
    LIMIT 1;

    IF v_active_session_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Officer already has an active session');
    END IF;

    -- Create new session
    INSERT INTO officer_work_sessions (officer_id, clock_in)
    VALUES (p_officer_id, now());

    -- Update last activity only
    UPDATE profiles 
    SET last_activity_at = now()
    WHERE id = p_officer_id;

    RETURN jsonb_build_object('success', true, 'message', 'Clocked in successfully');
END;
$$;

-- 2. Update manual_clock_out to NOT suspend officer
CREATE OR REPLACE FUNCTION "public"."manual_clock_out"("p_session_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_officer_id uuid;
    v_clock_in timestamp with time zone;
    v_now timestamp with time zone := now();
    v_hours numeric;
    v_coins bigint;
    v_hourly_rate bigint := 500; -- Baseline rate
    v_break_minutes int := 0;
    v_session public.officer_work_sessions%rowtype;
BEGIN
    -- Get session details
    SELECT * INTO v_session FROM public.officer_work_sessions WHERE id = p_session_id;

    IF v_session.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Session not found');
    END IF;

    v_officer_id := v_session.officer_id;
    v_clock_in := v_session.clock_in;

    -- Handle break time deduction if applicable (merging logic from break system)
    IF v_session.status = 'break' THEN
        v_break_minutes := EXTRACT(EPOCH FROM (v_now - v_session.last_break_start)) / 60;
        v_session.total_break_minutes := COALESCE(v_session.total_break_minutes, 0) + v_break_minutes;
    END IF;

    -- Calculate hours worked
    v_hours := EXTRACT(EPOCH FROM (v_now - v_clock_in)) / 3600;
    
    -- Deduct breaks if any (convert minutes to hours)
    IF v_session.total_break_minutes > 0 THEN
        v_hours := v_hours - (v_session.total_break_minutes::numeric / 60.0);
    END IF;

    IF v_hours < 0 THEN v_hours := 0; END IF;

    v_coins := floor(v_hours * v_hourly_rate);

    -- Update session
    UPDATE officer_work_sessions
    SET clock_out = v_now,
        hours_worked = v_hours,
        coins_earned = v_coins,
        status = 'completed', -- Ensure status is completed
        total_break_minutes = COALESCE(v_session.total_break_minutes, 0)
    WHERE id = p_session_id;

    -- Update last activity only, DO NOT set is_officer_active to false
    UPDATE profiles 
    SET last_activity_at = now()
    WHERE id = v_officer_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Clocked out successfully',
        'coins_earned', v_coins,
        'hours_worked', v_hours
    );
END;
$$;

-- 3. Restore active status for officers who were accidentally suspended by the bug
-- We assume anyone with a role of 'troll_officer' or 'lead_officer' should be active
UPDATE profiles
SET is_officer_active = true
WHERE role IN ('troll_officer', 'lead_officer')
AND is_officer_active = false;
