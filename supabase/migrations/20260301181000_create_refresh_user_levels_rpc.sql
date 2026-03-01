-- Create RPC function to refresh user levels from gifting history
CREATE OR REPLACE FUNCTION refresh_user_levels_from_gifts()
RETURNS TABLE (
    user_id uuid,
    old_level integer,
    new_level integer,
    total_xp bigint
) AS $$
BEGIN
    -- First, ensure all users have entries in user_stats
    INSERT INTO user_stats (user_id, level, total_xp, next_level_xp, current_xp, updated_at)
    SELECT 
        up.id,
        1,
        0,
        100,
        0,
        NOW()
    FROM user_profiles up
    LEFT JOIN user_stats us ON up.id = us.user_id
    WHERE us.user_id IS NULL
    ON CONFLICT (user_id) DO NOTHING;

    -- Calculate XP from gifts received (as broadcaster)
    RETURN QUERY
    WITH broadcaster_xp AS (
        SELECT 
            s.broadcaster_id,
            COALESCE(SUM(s.total_gifts_coins), 0) as xp_from_broadcasting
        FROM streams s
        WHERE s.is_live = false AND s.ended_at IS NOT NULL
        GROUP BY s.broadcaster_id
    ),
    -- Calculate XP from gifts sent
    gifter_xp AS (
        SELECT 
            gh.sender_id,
            COALESCE(SUM(gh.coin_cost), 0) * 0.5 as xp_from_gifting
        FROM gift_history gh
        GROUP BY gh.sender_id
    ),
    -- Calculate total XP for each user
    calculated_xp AS (
        SELECT 
            up.id,
            COALESCE(b.xp_from_broadcasting, 0) + COALESCE(g.xp_from_gifting, 0) as total_xp,
            COALESCE(b.xp_from_broadcasting, 0) as stream_xp,
            COALESCE(g.xp_from_gifting, 0) as buyer_xp
        FROM user_profiles up
        LEFT JOIN broadcaster_xp b ON up.id = b.broadcaster_id
        LEFT JOIN gifter_xp g ON up.id = g.sender_id
    ),
    -- Update and capture old values
    updated_stats AS (
        UPDATE user_stats us
        SET 
            total_xp = cx.total_xp::integer,
            current_xp = (cx.total_xp - (FLOOR(cx.total_xp / 100) * 100))::integer,
            level = (FLOOR(cx.total_xp / 100) + 1)::integer,
            next_level_xp = ((FLOOR(cx.total_xp / 100) + 1) * 100)::integer,
            buyer_level = (FLOOR(cx.buyer_xp / 100) + 1)::integer,
            buyer_xp = cx.buyer_xp::integer,
            stream_level = (FLOOR(cx.stream_xp / 100) + 1)::integer,
            stream_xp = cx.stream_xp::integer,
            updated_at = NOW()
        FROM calculated_xp cx
        WHERE us.user_id = cx.id
            AND cx.total_xp > 0
        RETURNING us.user_id, us.level, us.total_xp
    )
    SELECT 
        us.user_id,
        NULL::integer as old_level,  -- We don't track old level in this query
        us.level as new_level,
        us.total_xp::bigint
    FROM updated_stats us;
    
    -- Update user_profiles to keep in sync
    UPDATE user_profiles up
    SET 
        level = us.level,
        xp = us.total_xp,
        total_xp = us.total_xp,
        next_level_xp = us.next_level_xp,
        updated_at = NOW()
    FROM user_stats us
    WHERE up.id = us.user_id
        AND (up.level IS NULL OR up.level != us.level OR up.xp IS NULL OR up.xp != us.total_xp);
        
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION refresh_user_levels_from_gifts() IS 
'Recalculates all user levels based on their gifting history. 
XP is calculated as:
- 1 XP per coin received as broadcaster
- 0.5 XP per coin spent on gifts
Level = (total_xp / 100) + 1';

-- Grant execute to authenticated users (admin only via RLS)
GRANT EXECUTE ON FUNCTION refresh_user_levels_from_gifts() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_user_levels_from_gifts() TO service_role;
