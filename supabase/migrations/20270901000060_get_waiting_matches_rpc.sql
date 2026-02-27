CREATE OR REPLACE FUNCTION public.get_waiting_matches()
RETURNS TABLE (
    match_id UUID,
    game_type TEXT,
    player1_username TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        tb.id AS match_id,
        tb.game_type,
        p.username AS player1_username
    FROM
        public.troll_battles AS tb
    JOIN
        public.user_profiles AS p ON tb.host_id = p.id
    WHERE
        tb.status = 'pending' AND tb.challenger_id IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_waiting_matches() TO authenticated, service_role;