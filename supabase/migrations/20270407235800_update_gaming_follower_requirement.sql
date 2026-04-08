-- Update gaming category follower requirement from 100 to 10 followers
CREATE OR REPLACE FUNCTION public.is_trollmers_eligible(
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_followers_count INTEGER;
    v_user_role TEXT;
BEGIN
    -- Check if user is admin (bypass follower requirement)
    SELECT role INTO v_user_role
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF v_user_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Check follower count for non-admins - 10 followers required for gaming
    SELECT COUNT(*)
    INTO v_followers_count
    FROM public.user_follows
    WHERE following_id = p_user_id;

    RETURN v_followers_count >= 10;
END;
$$;
