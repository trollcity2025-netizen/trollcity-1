-- Discovery & City Events System
-- Stream ranking algorithm and scheduled city-wide events

-- Stream ranking scores table
CREATE TABLE IF NOT EXISTS stream_ranking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    viewer_count INTEGER DEFAULT 0,
    gift_velocity DECIMAL(10,2) DEFAULT 0, -- gifts per minute
    viewer_velocity DECIMAL(10,2) DEFAULT 0, -- viewers gained per minute
    engagement_score DECIMAL(5,2) DEFAULT 0, -- 0-100 based on chat activity
    trending_score DECIMAL(5,2) DEFAULT 0, -- based on recent growth
    freshness_bonus DECIMAL(5,2) DEFAULT 0, -- bonus for new streams
    creator_reputation DECIMAL(5,2) DEFAULT 0, -- based on creator's reputation score
    final_score DECIMAL(8,2) DEFAULT 0,
    rank_position INTEGER,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_stream_ranking UNIQUE (stream_id)
);

-- City events table
CREATE TABLE IF NOT EXISTS city_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- 'global_boost', 'coin_rain', 'special_stream', 'holiday_event', 'competition'
    title VARCHAR(200) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    global_announcement BOOLEAN DEFAULT FALSE,
    banner_image_url TEXT,
    event_config JSONB DEFAULT '{}', -- Event-specific configuration
    rewards_config JSONB DEFAULT '{}', -- Reward structure
    participation_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event participants table
CREATE TABLE IF NOT EXISTS event_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES city_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    participation_type VARCHAR(50) DEFAULT 'viewer', -- 'viewer', 'creator', 'winner'
    points_earned INTEGER DEFAULT 0,
    rewards_claimed JSONB DEFAULT '[]',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_event_participant UNIQUE (event_id, user_id)
);

-- Stream discovery preferences
CREATE TABLE IF NOT EXISTS stream_discovery_prefs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    preferred_categories TEXT[] DEFAULT '{}',
    preferred_languages TEXT[] DEFAULT '{}',
    content_rating_min INTEGER DEFAULT 0, -- minimum creator reputation
    avoid_categories TEXT[] DEFAULT '{}',
    discovery_algorithm VARCHAR(20) DEFAULT 'balanced', -- 'trending', 'personalized', 'random', 'balanced'
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_discovery_prefs UNIQUE (user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stream_ranking_score ON stream_ranking(final_score DESC);
CREATE INDEX IF NOT EXISTS idx_stream_ranking_updated ON stream_ranking(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_city_events_active ON city_events(is_active);
CREATE INDEX IF NOT EXISTS idx_city_events_time ON city_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_discovery_prefs_user ON stream_discovery_prefs(user_id);

-- RLS Policies
ALTER TABLE stream_ranking ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_discovery_prefs ENABLE ROW LEVEL SECURITY;

-- Stream ranking - readable by all, writable by system/admin
CREATE POLICY "Stream ranking read access" ON stream_ranking FOR SELECT USING (true);

CREATE POLICY "Stream ranking admin write" ON stream_ranking
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

-- City events - readable by all, writable by admin
CREATE POLICY "City events read access" ON city_events FOR SELECT USING (true);

CREATE POLICY "City events admin write" ON city_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

-- Event participants - users can see their own, admins can see all
CREATE POLICY "Event participants read access" ON event_participants
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

CREATE POLICY "Event participants write access" ON event_participants
    FOR ALL USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

-- Stream discovery prefs - users can manage their own
CREATE POLICY "Stream discovery prefs access" ON stream_discovery_prefs
    FOR ALL USING (user_id = auth.uid());

-- Functions for stream ranking algorithm
CREATE OR REPLACE FUNCTION calculate_stream_ranking(p_stream_id UUID DEFAULT NULL)
RETURNS TABLE (
    stream_id UUID,
    final_score DECIMAL,
    rank_position INTEGER
) AS $$
DECLARE
    stream_record RECORD;
    viewer_score DECIMAL := 0;
    gift_score DECIMAL := 0;
    engagement_score DECIMAL := 0;
    trending_score DECIMAL := 0;
    freshness_score DECIMAL := 0;
    reputation_score DECIMAL := 0;
    total_score DECIMAL := 0;
BEGIN
    -- If specific stream provided, calculate for that one
    IF p_stream_id IS NOT NULL THEN
        SELECT * INTO stream_record FROM streams WHERE id = p_stream_id AND is_live = TRUE;

        IF FOUND THEN
            -- Calculate viewer score (0-20 points)
            viewer_score := LEAST(stream_record.current_viewers / 10.0, 20.0);

            -- Calculate gift velocity score (0-25 points) - gifts per minute
            SELECT COALESCE(SUM(amount) / GREATEST(EXTRACT(EPOCH FROM (NOW() - stream_record.created_at)) / 60, 1), 0)
            INTO gift_score
            FROM gifts
            WHERE stream_id = p_stream_id
            AND created_at >= NOW() - INTERVAL '10 minutes';

            gift_score := LEAST(gift_score * 2, 25.0);

            -- Calculate engagement score (0-15 points) - chat messages per minute
            SELECT COALESCE(COUNT(*) / GREATEST(EXTRACT(EPOCH FROM (NOW() - stream_record.created_at)) / 60, 1), 0)
            INTO engagement_score
            FROM messages
            WHERE stream_id = p_stream_id
            AND created_at >= NOW() - INTERVAL '5 minutes';

            engagement_score := LEAST(engagement_score * 0.5, 15.0);

            -- Calculate trending score (0-15 points) - recent viewer growth
            SELECT COALESCE(AVG(current_viewers), 0) INTO trending_score
            FROM stream_viewer_history
            WHERE stream_id = p_stream_id
            AND recorded_at >= NOW() - INTERVAL '5 minutes';

            trending_score := LEAST(trending_score / 20.0, 15.0);

            -- Calculate freshness bonus (0-10 points) - newer streams get bonus
            SELECT EXTRACT(EPOCH FROM (NOW() - stream_record.created_at)) / 3600 INTO freshness_score;
            freshness_score := GREATEST(10.0 - freshness_score, 0);

            -- Calculate creator reputation score (0-15 points)
            SELECT COALESCE(current_score / 10.0, 5.0) INTO reputation_score
            FROM user_reputation
            WHERE user_id = stream_record.broadcaster_id;

            reputation_score := LEAST(reputation_score, 15.0);

            -- Calculate final score
            total_score := viewer_score + gift_score + engagement_score + trending_score + freshness_score + reputation_score;

            -- Update ranking record
            INSERT INTO stream_ranking (
                stream_id, viewer_count, gift_velocity, engagement_score,
                trending_score, freshness_bonus, creator_reputation, final_score
            ) VALUES (
                p_stream_id, stream_record.current_viewers, gift_score, engagement_score,
                trending_score, freshness_score, reputation_score, total_score
            ) ON CONFLICT (stream_id) DO UPDATE SET
                viewer_count = stream_record.current_viewers,
                gift_velocity = gift_score,
                engagement_score = engagement_score,
                trending_score = trending_score,
                freshness_bonus = freshness_score,
                creator_reputation = reputation_score,
                final_score = total_score,
                last_updated = NOW();

            RETURN QUERY SELECT p_stream_id, total_score, 0;
        END IF;
    ELSE
        -- Calculate rankings for all live streams
        FOR stream_record IN SELECT * FROM streams WHERE is_live = TRUE ORDER BY created_at DESC LOOP
            -- Calculate scores for each stream (same logic as above)
            viewer_score := LEAST(stream_record.current_viewers / 10.0, 20.0);

            SELECT COALESCE(SUM(amount) / GREATEST(EXTRACT(EPOCH FROM (NOW() - stream_record.created_at)) / 60, 1), 0)
            INTO gift_score
            FROM gifts
            WHERE stream_id = stream_record.id
            AND created_at >= NOW() - INTERVAL '10 minutes';

            gift_score := LEAST(gift_score * 2, 25.0);

            SELECT COALESCE(COUNT(*) / GREATEST(EXTRACT(EPOCH FROM (NOW() - stream_record.created_at)) / 60, 1), 0)
            INTO engagement_score
            FROM messages
            WHERE stream_id = stream_record.id
            AND created_at >= NOW() - INTERVAL '5 minutes';

            engagement_score := LEAST(engagement_score * 0.5, 15.0);

            SELECT EXTRACT(EPOCH FROM (NOW() - stream_record.created_at)) / 3600 INTO freshness_score;
            freshness_score := GREATEST(10.0 - freshness_score, 0);

            SELECT COALESCE(current_score / 10.0, 5.0) INTO reputation_score
            FROM user_reputation
            WHERE user_id = stream_record.broadcaster_id;

            reputation_score := LEAST(reputation_score, 15.0);

            total_score := viewer_score + gift_score + engagement_score + trending_score + freshness_score + reputation_score;

            -- Update ranking record
            INSERT INTO stream_ranking (
                stream_id, viewer_count, gift_velocity, engagement_score,
                trending_score, freshness_bonus, creator_reputation, final_score
            ) VALUES (
                stream_record.id, stream_record.current_viewers, gift_score, engagement_score,
                trending_score, freshness_score, reputation_score, total_score
            ) ON CONFLICT (stream_id) DO UPDATE SET
                viewer_count = stream_record.current_viewers,
                gift_velocity = gift_score,
                engagement_score = engagement_score,
                trending_score = trending_score,
                freshness_bonus = freshness_score,
                creator_reputation = reputation_score,
                final_score = total_score,
                last_updated = NOW();

            RETURN QUERY SELECT stream_record.id, total_score, 0;
        END LOOP;

        -- Update rank positions
        UPDATE stream_ranking
        SET rank_position = ranked.position
        FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY final_score DESC) as position
            FROM stream_ranking
            WHERE last_updated >= NOW() - INTERVAL '5 minutes'
        ) ranked
        WHERE stream_ranking.id = ranked.id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create city event
CREATE OR REPLACE FUNCTION create_city_event(
    p_event_type VARCHAR(50),
    p_title VARCHAR(200),
    p_description TEXT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_global_announcement BOOLEAN DEFAULT FALSE,
    p_event_config JSONB DEFAULT '{}',
    p_rewards_config JSONB DEFAULT '{}',
    p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO city_events (
        event_type, title, description, start_time, end_time,
        global_announcement, event_config, rewards_config, created_by
    ) VALUES (
        p_event_type, p_title, p_description, p_start_time, p_end_time,
        p_global_announcement, p_event_config, p_rewards_config, p_created_by
    ) RETURNING id INTO event_id;

    -- Send global announcement if requested
    IF p_global_announcement THEN
        PERFORM send_notification(
            NULL, -- broadcast to all
            'city_event',
            '🎉 ' || p_title,
            p_description,
            jsonb_build_object(
                'event_id', event_id,
                'event_type', p_event_type,
                'start_time', p_start_time,
                'end_time', p_end_time
            )
        );
    END IF;

    RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to join city event
CREATE OR REPLACE FUNCTION join_city_event(p_event_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO event_participants (event_id, user_id)
    VALUES (p_event_id, p_user_id)
    ON CONFLICT (event_id, user_id) DO NOTHING;

    -- Update participation count
    UPDATE city_events
    SET participation_count = participation_count + 1
    WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get personalized stream recommendations
CREATE OR REPLACE FUNCTION get_stream_recommendations(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_algorithm VARCHAR(20) DEFAULT 'balanced'
) RETURNS TABLE (
    stream_id UUID,
    title VARCHAR(255),
    category VARCHAR(100),
    current_viewers INTEGER,
    final_score DECIMAL,
    rank_position INTEGER,
    broadcaster_username VARCHAR(255)
) AS $$
DECLARE
    user_prefs RECORD;
BEGIN
    -- Get user preferences
    SELECT * INTO user_prefs
    FROM stream_discovery_prefs
    WHERE user_id = p_user_id;

    -- If no preferences, use defaults
    IF user_prefs IS NULL THEN
        user_prefs := ROW(p_user_id, '{}', '{}', 0, '{}', 'balanced', NOW(), NOW())::stream_discovery_prefs;
    END IF;

    CASE p_algorithm
        WHEN 'trending' THEN
            -- Return highest scoring streams
            RETURN QUERY
            SELECT
                s.id,
                s.title,
                s.category,
                s.current_viewers,
                sr.final_score,
                sr.rank_position,
                up.username
            FROM streams s
            JOIN stream_ranking sr ON s.id = sr.stream_id
            JOIN user_profiles up ON s.broadcaster_id = up.id
            WHERE s.is_live = TRUE
            ORDER BY sr.final_score DESC
            LIMIT p_limit;

        WHEN 'personalized' THEN
            -- Filter by user preferences
            RETURN QUERY
            SELECT
                s.id,
                s.title,
                s.category,
                s.current_viewers,
                sr.final_score,
                sr.rank_position,
                up.username
            FROM streams s
            JOIN stream_ranking sr ON s.id = sr.stream_id
            JOIN user_profiles up ON s.broadcaster_id = up.id
            LEFT JOIN user_reputation ur ON up.id = ur.user_id
            WHERE s.is_live = TRUE
            AND (array_length(user_prefs.preferred_categories, 1) IS NULL OR s.category = ANY(user_prefs.preferred_categories))
            AND (user_prefs.content_rating_min = 0 OR COALESCE(ur.current_score, 50) >= user_prefs.content_rating_min)
            AND (array_length(user_prefs.avoid_categories, 1) IS NULL OR s.category != ALL(user_prefs.avoid_categories))
            ORDER BY sr.final_score DESC
            LIMIT p_limit;

        ELSE
            -- Balanced approach (default)
            RETURN QUERY
            SELECT
                s.id,
                s.title,
                s.category,
                s.current_viewers,
                sr.final_score,
                sr.rank_position,
                up.username
            FROM streams s
            JOIN stream_ranking sr ON s.id = sr.stream_id
            JOIN user_profiles up ON s.broadcaster_id = up.id
            WHERE s.is_live = TRUE
            ORDER BY
                -- Mix of score and some randomness for discovery
                (sr.final_score * 0.7 + random() * 30) DESC
            LIMIT p_limit;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;