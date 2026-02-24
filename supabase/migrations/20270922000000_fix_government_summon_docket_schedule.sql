-- Government summon + docket scheduling hardening
-- Rules:
-- 1) Staff roles can issue summons (admin, troll officer, lead troll officer, judge, secretary)
-- 2) Dockets cap at 20 cases
-- 3) Overflow auto-schedules to next court day (+4 days cadence, Tue/Sat)

ALTER TABLE public.court_dockets
ADD COLUMN IF NOT EXISTS max_cases INTEGER DEFAULT 20;

CREATE OR REPLACE FUNCTION public.next_court_day(p_date DATE)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_dow INTEGER;
BEGIN
  v_dow := EXTRACT(DOW FROM p_date);

  -- PostgreSQL DOW: Sunday=0 ... Saturday=6
  IF v_dow = 2 OR v_dow = 6 THEN
    RETURN p_date; -- Tuesday or Saturday
  ELSIF v_dow < 2 THEN
    RETURN p_date + (2 - v_dow); -- next Tuesday
  ELSIF v_dow < 6 THEN
    RETURN p_date + (6 - v_dow); -- next Saturday
  END IF;

  RETURN p_date + 3; -- Sunday -> next Tuesday
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_next_docket(
  p_from_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_docket_id UUID;
  v_date DATE;
BEGIN
  -- Find earliest open docket with available capacity from requested date onward.
  SELECT d.id
  INTO v_docket_id
  FROM public.court_dockets d
  LEFT JOIN public.court_cases c ON c.docket_id = d.id
  WHERE d.status IN ('open', 'active')
    AND d.court_date >= p_from_date
  GROUP BY d.id, d.court_date, d.max_cases
  HAVING COUNT(c.id) < COALESCE(d.max_cases, 20)
  ORDER BY d.court_date ASC
  LIMIT 1;

  IF v_docket_id IS NOT NULL THEN
    RETURN v_docket_id;
  END IF;

  -- No open capacity: create the next docket.
  SELECT MAX(court_date)
  INTO v_date
  FROM public.court_dockets
  WHERE court_date >= p_from_date;

  IF v_date IS NULL THEN
    v_date := public.next_court_day(p_from_date);
  ELSE
    -- Court cadence requested: move forward by 4 days.
    v_date := public.next_court_day(v_date + 4);
  END IF;

  INSERT INTO public.court_dockets (court_date, max_cases, status)
  VALUES (v_date, 20, 'open')
  ON CONFLICT (court_date) DO UPDATE
    SET status = CASE
      WHEN public.court_dockets.status IN ('closed', 'completed') THEN 'open'
      ELSE public.court_dockets.status
    END
  RETURNING id INTO v_docket_id;

  RETURN v_docket_id;
END;
$$;

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
      p_users_involved
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

GRANT EXECUTE ON FUNCTION public.next_court_day(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_next_docket(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.summon_user_to_court(UUID, TEXT, TEXT, UUID) TO authenticated;
