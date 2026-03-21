-- =============================================
-- TROLL MATCH (TM) SYSTEM DATABASE MIGRATION
-- =============================================

-- 1. Add TM-related columns to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS dating_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS preference TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS message_price INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW();

-- 2. Create profile_views table for "Viewed Me" feature
CREATE TABLE IF NOT EXISTS profile_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    viewed_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create index for efficient profile view queries
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_user 
ON profile_views(viewed_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_views_viewer 
ON profile_views(viewer_id);

-- 4. Create TM messages table for TCPS integration
CREATE TABLE IF NOT EXISTS tm_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    price_paid INTEGER DEFAULT 0,
    source TEXT DEFAULT 'troll_match',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create index for TM messages
CREATE INDEX IF NOT EXISTS idx_tm_messages_receiver 
ON tm_messages(receiver_id, created_at DESC);

-- 6. Create family_invites table for broadcaster-to-user invites
CREATE TABLE IF NOT EXISTS family_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    invitee_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    family_id UUID REFERENCES troll_families(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_invites_invitee 
ON family_invites(invitee_id, status);

-- 7. Create RPC function to get matches
CREATE OR REPLACE FUNCTION get_tm_matches(
    p_user_id UUID,
    p_dating BOOLEAN DEFAULT false,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    avatar_url TEXT,
    interests TEXT[],
    shared_interests TEXT[],
    match_score INTEGER,
    is_online BOOLEAN,
    last_active TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_interests TEXT[];
    v_gender TEXT;
    v_preference TEXT[];
BEGIN
    -- Get current user's interests, gender, and preferences
    SELECT up.interests, up.gender, up.preference INTO v_interests, v_gender, v_preference
    FROM user_profiles up
    WHERE up.id = p_user_id;

    IF v_interests IS NULL THEN
        v_interests := '{}';
    END IF;

    IF v_preference IS NULL THEN
        v_preference := '{}';
    END IF;

    RETURN QUERY
    SELECT 
        up.id::UUID as user_id,
        up.username::TEXT,
        up.avatar_url::TEXT,
        COALESCE(up.interests, '{}'::TEXT[]),
        COALESCE(ARRAY(
            SELECT i::TEXT 
            FROM unnest(v_interests) AS i
            WHERE i = ANY(COALESCE(up.interests, '{}'::TEXT[]))
        ), '{}'::TEXT[]) as shared_interests,
        (
            (SELECT COALESCE(COUNT(*), 0) FROM unnest(v_interests) AS i 
             WHERE i = ANY(COALESCE(up.interests, '{}'::TEXT[]))) * 2 +
            CASE WHEN up.is_online = true THEN 5 ELSE 0 END +
            CASE WHEN up.last_active > NOW() - INTERVAL '1 hour' THEN 3 
                 WHEN up.last_active > NOW() - INTERVAL '24 hours' THEN 2 
                 WHEN up.last_active > NOW() - INTERVAL '7 days' THEN 1 
                 ELSE 0 END
        )::INTEGER as match_score,
        up.is_online::BOOLEAN,
        up.last_active::TIMESTAMPTZ
    FROM user_profiles up
    WHERE up.id != p_user_id
    AND up.interests && v_interests
    AND (
        NOT p_dating 
        OR (
            up.dating_enabled = true
            AND up.gender = ANY(v_preference)
            AND v_gender = ANY(up.preference)
        )
    )
    ORDER BY match_score DESC, up.last_active DESC
    LIMIT p_limit;
END;
$$;

-- 8. Create RPC function to get viewed me users
CREATE OR REPLACE FUNCTION get_viewed_me_users(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    viewer_id UUID,
    username TEXT,
    avatar_url TEXT,
    viewed_at TIMESTAMPTZ,
    is_online BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pv.viewer_id,
        up.username,
        up.avatar_url,
        pv.created_at as viewed_at,
        up.is_online
    FROM profile_views pv
    JOIN user_profiles up ON pv.viewer_id = up.id
    WHERE pv.viewed_user_id = p_user_id
    ORDER BY pv.created_at DESC
    LIMIT p_limit;
END;
$$;

-- 9. Create RPC function to record profile view
CREATE OR REPLACE FUNCTION record_profile_view(
    p_viewer_id UUID,
    p_viewed_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO profile_views (viewer_id, viewed_user_id)
    VALUES (p_viewer_id, p_viewed_user_id)
    ON CONFLICT (viewer_id, viewed_user_id) 
    DO UPDATE SET created_at = NOW();
END;
$$;

-- 10. Create RPC function to update user TM profile
CREATE OR REPLACE FUNCTION update_tm_profile(
    p_user_id UUID,
    p_interests TEXT[] DEFAULT NULL,
    p_dating_enabled BOOLEAN DEFAULT NULL,
    p_gender TEXT DEFAULT NULL,
    p_preference TEXT[] DEFAULT NULL,
    p_message_price INTEGER DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE user_profiles SET
        interests = COALESCE(p_interests, interests),
        dating_enabled = COALESCE(p_dating_enabled, dating_enabled),
        gender = COALESCE(p_gender, gender),
        preference = COALESCE(p_preference, preference),
        message_price = COALESCE(p_message_price, message_price),
        last_active = NOW()
    WHERE id = p_user_id;
END;
$$;

-- 11. Create RPC function to send TM message via TCPS
CREATE OR REPLACE FUNCTION send_tm_message(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_message TEXT,
    p_price_paid INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id UUID;
BEGIN
    INSERT INTO tm_messages (sender_id, receiver_id, message, price_paid)
    VALUES (p_sender_id, p_receiver_id, p_message, p_price_paid)
    RETURNING id INTO v_message_id;
    RETURN v_message_id;
END;
$$;

-- 12. Create RPC function to create family invite
CREATE OR REPLACE FUNCTION create_family_invite(
    p_inviter_id UUID,
    p_invitee_id UUID,
    p_family_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invite_id UUID;
BEGIN
    INSERT INTO family_invites (inviter_id, invitee_id, family_id)
    VALUES (p_inviter_id, p_invitee_id, p_family_id)
    RETURNING id INTO v_invite_id;
    RETURN v_invite_id;
END;
$$;

-- 13. Create RPC function to respond to family invite
CREATE OR REPLACE FUNCTION respond_family_invite(
    p_invite_id UUID,
    p_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE family_invites SET
        status = p_status,
        updated_at = NOW()
    WHERE id = p_invite_id;
END;
$$;

-- 14. Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON profile_views TO anon, authenticated;
GRANT SELECT ON tm_messages TO anon, authenticated;
GRANT SELECT ON family_invites TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_tm_matches TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_viewed_me_users TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_profile_view TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_tm_profile TO authenticated;
GRANT EXECUTE ON FUNCTION send_tm_message TO authenticated;
GRANT EXECUTE ON FUNCTION create_family_invite TO authenticated;
GRANT EXECUTE ON FUNCTION respond_family_invite TO authenticated;

-- 15. Add RLS policies
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_views_read_own" ON profile_views;
CREATE POLICY "profile_views_read_own" ON profile_views
    FOR SELECT USING (viewer_id = auth.uid() OR viewed_user_id = auth.uid());

DROP POLICY IF EXISTS "tm_messages_read_own" ON tm_messages;
CREATE POLICY "tm_messages_read_own" ON tm_messages
    FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "family_invites_manage" ON family_invites;
CREATE POLICY "family_invites_manage" ON family_invites
    FOR ALL USING (inviter_id = auth.uid() OR invitee_id = auth.uid());
