
-- Function to calculate the next valid court day (Mon-Fri)
CREATE OR REPLACE FUNCTION public.next_court_day(p_from_date DATE)
RETURNS DATE
LANGUAGE plpgsql
AS $$
DECLARE
    v_next_day DATE;
    v_day_of_week INT;
BEGIN
    v_next_day := p_from_date + 1;
    v_day_of_week := EXTRACT(ISODOW FROM v_next_day);

    IF v_day_of_week = 6 THEN -- Saturday
        v_next_day := v_next_day + 2;
    ELSIF v_day_of_week = 7 THEN -- Sunday
        v_next_day := v_next_day + 1;
    END IF;

    RETURN v_next_day;
END;
$$;

-- Update get_or_create_next_docket to use the new function
CREATE OR REPLACE FUNCTION public.get_or_create_next_docket(p_from_date DATE DEFAULT CURRENT_DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_docket_id UUID;
    v_date DATE;
BEGIN
    -- Find the earliest open docket with space
    SELECT d.id INTO v_docket_id
    FROM public.court_dockets d
    LEFT JOIN public.court_cases c ON c.docket_id = d.id
    WHERE d.status = 'open' AND d.court_date >= p_from_date
    GROUP BY d.id
    HAVING COUNT(c.id) < d.max_cases
    ORDER BY d.court_date ASC
    LIMIT 1;

    IF v_docket_id IS NOT NULL THEN
        RETURN v_docket_id;
    END IF;

    -- Otherwise, create a new docket for the next available court day
    SELECT public.next_court_day(COALESCE(MAX(court_date), p_from_date))
    INTO v_date
    FROM public.court_dockets;

    INSERT INTO public.court_dockets (court_date, status)
    VALUES (v_date, 'open')
    RETURNING id INTO v_docket_id;

    RETURN v_docket_id;
END;
$$;
