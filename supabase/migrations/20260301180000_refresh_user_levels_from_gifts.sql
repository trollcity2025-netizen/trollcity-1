-- Migration: Refresh all user levels based on gifting history
-- This calculates XP from gifts sent/received and updates user_stats

-- First, ensure all users have entries in user_stats
INSERT INTO user_stats (user_id, level, total_xp, next_level_xp, current_xp, updated_at)
SELECT 
    up.id as user_id,
    1 as level,
    0 as total_xp,
    100 as next_level_xp,
    0 as current_xp,
    NOW() as updated_at
FROM user_profiles up
LEFT JOIN user_stats us ON up.id = us.user_id
WHERE us.user_id IS NULL;

-- Calculate XP from gifts received (as broadcaster)
-- Each coin received = 1 XP
WITH broadcaster_xp AS (
    SELECT 
        broadcaster_id as user_id,
        COALESCE(SUM(total_gifts_coins), 0) as xp_from_broadcasting
    FROM streams
    WHERE is_live = false AND ended_at IS NOT NULL
    GROUP BY broadcaster_id
),
-- Calculate XP from gifts sent
-- Each coin sent = 0.5 XP (buyer XP)
gifter_xp AS (
    SELECT 
        sender_id as user_id,
        COALESCE(SUM(coin_cost), 0) * 0.5 as xp_from_gifting
    FROM gift_history
    GROUP BY sender_id
),
-- Calculate total XP for each user
calculated_xp AS (
    SELECT 
        up.id as user_id,
        COALESCE(b.xp_from_broadcasting, 0) + COALESCE(g.xp_from_gifting, 0) as total_xp
    FROM user_profiles up
    LEFT JOIN broadcaster_xp b ON up.id = b.user_id
    LEFT JOIN gifter_xp g ON up.id = g.user_id
    WHERE COALESCE(b.xp_from_broadcasting, 0) + COALESCE(g.xp_from_gifting, 0) > 0
)
-- Update user_stats with calculated levels
UPDATE user_stats us
SET 
    total_xp = cx.total_xp,
    current_xp = cx.total_xp - (FLOOR(cx.total_xp / 100) * 100),
    level = FLOOR(cx.total_xp / 100) + 1,
    next_level_xp = (FLOOR(cx.total_xp / 100) + 1) * 100,
    buyer_level = FLOOR(cx.total_xp / 100) + 1,
    buyer_xp = cx.total_xp,
    stream_level = FLOOR(COALESCE(b.xp_from_broadcasting, 0) / 100) + 1,
    stream_xp = COALESCE(b.xp_from_broadcasting, 0),
    updated_at = NOW()
FROM calculated_xp cx
LEFT JOIN broadcaster_xp b ON cx.user_id = b.user_id
WHERE us.user_id = cx.user_id;

-- Also update user_profiles to keep in sync
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

-- Log the update
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count FROM user_stats WHERE updated_at > NOW() - INTERVAL '5 minutes';
    RAISE NOTICE 'Updated % user level records', updated_count;
END $$;
