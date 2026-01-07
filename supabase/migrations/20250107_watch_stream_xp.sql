-- Secure functions for Watch and Stream XP
-- These wrappers prevent users from calling add_xp with arbitrary amounts

-- 1. Add Watch XP (5 XP per call)
CREATE OR REPLACE FUNCTION add_watch_xp(p_user_id UUID)
RETURNS JSONB AS $$
BEGIN
    -- Security check: Ensure user is updating themselves
    IF auth.uid() != p_user_id THEN
        RETURN jsonb_build_object('success', false, 'reason', 'unauthorized');
    END IF;

    -- Award 5 XP (Logic in add_xp handles the daily cap of 60)
    RETURN add_xp(p_user_id, 5, 'watch');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add Stream XP (20 XP per call)
CREATE OR REPLACE FUNCTION add_stream_xp(p_user_id UUID)
RETURNS JSONB AS $$
BEGIN
    -- Security check: Ensure user is updating themselves
    IF auth.uid() != p_user_id THEN
        RETURN jsonb_build_object('success', false, 'reason', 'unauthorized');
    END IF;

    -- Award 20 XP (Streaming has no hard daily cap in add_xp currently, which is intended)
    RETURN add_xp(p_user_id, 20, 'stream');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_watch_xp(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_stream_xp(UUID) TO authenticated;
