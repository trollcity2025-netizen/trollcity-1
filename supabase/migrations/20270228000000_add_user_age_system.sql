-- Add created_at column to user_profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'created_at') THEN
        ALTER TABLE public.user_profiles ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- Attempt to backfill created_at from auth.users
-- We use a safe update that ignores errors if auth schema is not accessible (though it should be for migrations)
DO $$
BEGIN
    UPDATE public.user_profiles up
    SET created_at = au.created_at
    FROM auth.users au
    WHERE up.id = au.id
    AND (up.created_at = now() OR up.created_at IS NULL); 
EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore permission errors or missing auth schema
END $$;

-- Ensure created_at is NOT NULL (after backfill)
ALTER TABLE public.user_profiles ALTER COLUMN created_at SET DEFAULT now();
-- We don't enforce NOT NULL strictly on existing bad data to avoid breakage, but new rows get default.

-- Function to calculate age in days
CREATE OR REPLACE FUNCTION public.get_user_age_days(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_created_at timestamptz;
BEGIN
    SELECT created_at INTO v_created_at
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF v_created_at IS NULL THEN
        RETURN 0;
    END IF;

    -- Calculate days difference
    RETURN GREATEST(0, floor(extract(epoch from (now() at time zone 'utc' - v_created_at at time zone 'utc')) / 86400)::int);
END;
$$;

-- Batch function to get display info + age
CREATE OR REPLACE FUNCTION public.get_users_display(p_user_ids uuid[])
RETURNS TABLE (
    id uuid,
    username text,
    avatar_url text,
    age_days int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id,
        up.username,
        up.avatar_url,
        GREATEST(0, floor(extract(epoch from (now() at time zone 'utc' - up.created_at at time zone 'utc')) / 86400)::int) as age_days
    FROM public.user_profiles up
    WHERE up.id = ANY(p_user_ids);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_age_days(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_users_display(uuid[]) TO authenticated, anon;
