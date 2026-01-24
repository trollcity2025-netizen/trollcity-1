
-- RPC to track family events automatically
-- This allows updating family tasks by metric without knowing the specific task ID

CREATE OR REPLACE FUNCTION public.track_family_event(
    p_user_id uuid,
    p_metric text,
    p_increment int DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_family_id uuid;
BEGIN
    -- Get user's family
    SELECT family_id INTO v_family_id
    FROM public.family_members
    WHERE user_id = p_user_id
    LIMIT 1;

    IF v_family_id IS NULL THEN
        RETURN;
    END IF;

    -- Update active tasks matching the metric
    -- Only update if current_value < goal_value (optional, but let's just increment)
    -- The UI handles the progress display capping
    UPDATE public.family_tasks
    SET current_value = current_value + p_increment,
        updated_at = now()
    WHERE family_id = v_family_id
    AND metric = p_metric
    AND status = 'active';
END;
$$;
