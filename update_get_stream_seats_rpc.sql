-- ============================================================================
-- UPDATE: Add trollmonds_balance to get_stream_seats RPC
-- This allows guest users in seats to see their trollmonds balance in real-time
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_stream_seats(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.get_stream_seats(p_stream_id UUID)
RETURNS TABLE (
    id UUID,
    seat_index INTEGER,
    user_id UUID,
    guest_id TEXT,
    status TEXT,
    joined_at TIMESTAMPTZ,
    username TEXT,
    avatar_url TEXT,
    is_gold BOOLEAN,
    role TEXT,
    troll_coins BIGINT,
    trollmonds_balance BIGINT,
    rgb_username_expires_at TIMESTAMPTZ,
    glowing_username_color TEXT,
    troll_role TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id::UUID,
        s.seat_index::INTEGER,
        s.user_id::UUID,
        s.guest_id::TEXT,
        s.status::TEXT,
        s.joined_at::TIMESTAMPTZ,
        (CASE 
            WHEN s.user_id IS NOT NULL THEN COALESCE(u.username, 'Unknown')
            ELSE COALESCE(s.guest_id, 'Guest')
        END)::TEXT as username,
        (CASE 
            WHEN s.user_id IS NOT NULL THEN COALESCE(u.avatar_url, 'https://ui-avatars.com/api/?name=' || COALESCE(u.username, 'User') || '&background=random')
            ELSE 'https://ui-avatars.com/api/?name=' || COALESCE(s.guest_id, 'Guest') || '&background=random'
        END)::TEXT as avatar_url,
        COALESCE(u.is_gold, false)::BOOLEAN as is_gold,
        COALESCE(u.role, 'guest')::TEXT as role,
        COALESCE(u.troll_coins, 0)::BIGINT as troll_coins,
        COALESCE(u.trollmonds_balance, 0)::BIGINT as trollmonds_balance,
        u.rgb_username_expires_at::TIMESTAMPTZ,
        u.glowing_username_color::TEXT,
        u.troll_role::TEXT,
        u.created_at::TIMESTAMPTZ
    FROM public.stream_seat_sessions s
    LEFT JOIN public.user_profiles u ON s.user_id = u.id
    WHERE s.stream_id = p_stream_id
    AND s.status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stream_seats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stream_seats(UUID) TO anon;

SELECT '✅ Migration applied: Added trollmonds_balance to get_stream_seats RPC';