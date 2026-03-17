-- Trollmin System Database Migrations
-- Creates all tables needed for the Trollmin (temporary city leader) system

-- Drop existing tables for clean recreation (if they exist with old broken schema)
DROP TABLE IF EXISTS trollmin_violations CASCADE;
DROP TABLE IF EXISTS trollmin_term_stats CASCADE;
DROP TABLE IF EXISTS trollmin_daily_limits CASCADE;
DROP TABLE IF EXISTS trollmin_approvals CASCADE;
DROP TABLE IF EXISTS trollmin_actions_log CASCADE;
DROP TABLE IF EXISTS trollmin_laws CASCADE;
DROP TABLE IF EXISTS trollmin_current CASCADE;
DROP TABLE IF EXISTS trollmin_queue CASCADE;

-- ==========================================
-- TROLLMIN QUEUE (Power Queue)
-- ==========================================
CREATE TABLE trollmin_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    coins_spent BIGINT NOT NULL DEFAULT 0,
    bid_amount BIGINT DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    queue_position INTEGER,
    status VARCHAR(20) DEFAULT 'waiting',
    is_banned_from_queue BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id)
);

-- ==========================================
-- CURRENT TROLLMIN
-- ==========================================
CREATE TABLE trollmin_current (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    term_days INTEGER DEFAULT 30,
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    approval_rating INTEGER DEFAULT 50,
    actions_count INTEGER DEFAULT 0,
    bans_count INTEGER DEFAULT 0,
    mutes_count INTEGER DEFAULT 0,
    pardons_count INTEGER DEFAULT 0,
    laws_created INTEGER DEFAULT 0,
    events_triggered INTEGER DEFAULT 0
);

-- Trigger function to auto-calculate ends_at
CREATE OR REPLACE FUNCTION set_trollmin_ends_at()
RETURNS TRIGGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    NEW.ends_at := NEW.started_at + (NEW.term_days * INTERVAL '1 day');
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_trollmin_ends_at
    BEFORE INSERT OR UPDATE ON trollmin_current
    FOR EACH ROW
    EXECUTE FUNCTION set_trollmin_ends_at();

-- ==========================================
-- TROLLMIN LAWS (City Laws)
-- ==========================================
CREATE TABLE trollmin_laws (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trollmin_id UUID REFERENCES trollmin_current(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    effect_type VARCHAR(50) NOT NULL,
    effect_value JSONB,
    duration_hours INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_by_username VARCHAR(100)
);

-- Trigger function to auto-calculate expires_at
CREATE OR REPLACE FUNCTION set_trollmin_law_expires_at()
RETURNS TRIGGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    NEW.expires_at := NEW.created_at + (NEW.duration_hours * INTERVAL '1 hour');
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_trollmin_law_expires_at
    BEFORE INSERT OR UPDATE ON trollmin_laws
    FOR EACH ROW
    EXECUTE FUNCTION set_trollmin_law_expires_at();

-- ==========================================
-- TROLLMIN ACTIONS LOG (Activity Feed)
-- ==========================================
CREATE TABLE trollmin_actions_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trollmin_id UUID REFERENCES trollmin_current(id) ON DELETE SET NULL,
    trollmin_username VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    target_username VARCHAR(100),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- TROLLMIN APPROVALS (Approval System)
-- ==========================================
CREATE TABLE trollmin_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trollmin_id UUID REFERENCES trollmin_current(id) ON DELETE CASCADE,
    vote VARCHAR(10) NOT NULL,
    voted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(voter_user_id, trollmin_id)
);

-- ==========================================
-- TROLLMIN DAILY LIMITS
-- ==========================================
CREATE TABLE trollmin_daily_limits (
    trollmin_id UUID NOT NULL REFERENCES trollmin_current(id) ON DELETE CASCADE,
    action_date DATE DEFAULT CURRENT_DATE,
    bans_used INTEGER DEFAULT 0,
    mutes_used INTEGER DEFAULT 0,
    events_used INTEGER DEFAULT 0,
    court_overrides_used INTEGER DEFAULT 0,
    PRIMARY KEY (trollmin_id, action_date)
);

-- ==========================================
-- TROLLMIN TERM STATS (Rewards)
-- ==========================================
CREATE TABLE trollmin_term_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    term_days INTEGER NOT NULL,
    final_approval_rating INTEGER,
    total_actions INTEGER,
    total_bans INTEGER,
    total_mutes INTEGER,
    total_pardons INTEGER,
    laws_created INTEGER,
    events_triggered INTEGER,
    reward_coins INTEGER DEFAULT 0,
    badge_earned BOOLEAN DEFAULT FALSE,
    final_rank INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- TROLLMIN VIOLATIONS (President Rules)
-- ==========================================
CREATE TABLE trollmin_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trollmin_id UUID NOT NULL REFERENCES trollmin_current(id) ON DELETE CASCADE,
    violation_type VARCHAR(50) NOT NULL,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'minor',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_trollmin_queue_position ON trollmin_queue(queue_position ASC, joined_at ASC);
CREATE INDEX IF NOT EXISTS idx_trollmin_queue_status ON trollmin_queue(status);
CREATE INDEX IF NOT EXISTS idx_trollmin_laws_active ON trollmin_laws(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_trollmin_actions_log_date ON trollmin_actions_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trollmin_approvals_voter ON trollmin_approvals(voter_user_id);
CREATE INDEX IF NOT EXISTS idx_trollmin_term_stats_user ON trollmin_term_stats(user_id);

-- ==========================================
-- FUNCTION: Get current Trollmin
-- ==========================================
CREATE OR REPLACE FUNCTION get_current_trollmin()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    username VARCHAR,
    started_at TIMESTAMPTZ,
    term_days INTEGER,
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN,
    approval_rating INTEGER,
    actions_count INTEGER,
    days_remaining INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tc.id,
        tc.user_id,
        tc.username,
        tc.started_at,
        tc.term_days,
        tc.ends_at,
        tc.is_active,
        tc.approval_rating,
        tc.actions_count,
        GREATEST(0, DATE_PART('day', tc.ends_at - NOW())::INTEGER) as days_remaining
    FROM trollmin_current tc
    WHERE tc.is_active = true
    ORDER BY tc.started_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCTION: Get Power Queue
-- ==========================================
CREATE OR REPLACE FUNCTION get_trollmin_queue()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    username VARCHAR,
    coins_spent BIGINT,
    bid_amount BIGINT,
    joined_at TIMESTAMPTZ,
    queue_position INTEGER,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tq.id,
        tq.user_id,
        tq.username,
        tq.coins_spent,
        tq.bid_amount,
        tq.joined_at,
        tq.queue_position,
        tq.status
    FROM trollmin_queue tq
    WHERE tq.status = 'waiting'
    ORDER BY tq.coins_spent DESC, tq.bid_amount DESC, tq.joined_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Drop old function if exists to avoid overload conflict
DROP FUNCTION IF EXISTS join_trollmin_queue(UUID, VARCHAR, INTEGER);

-- ==========================================
-- FUNCTION: Join Power Queue
-- ==========================================
CREATE OR REPLACE FUNCTION join_trollmin_queue(p_user_id UUID, p_username VARCHAR, p_coins BIGINT)
RETURNS JSONB AS $$
DECLARE
    v_entry_cost BIGINT := 5000;
    v_result JSONB;
    v_position INTEGER;
    v_existing_queue RECORD;
BEGIN
    SELECT * INTO v_existing_queue 
    FROM trollmin_queue 
    WHERE user_id = p_user_id AND status = 'waiting';
    
    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already in queue');
    END IF;
    
    IF EXISTS (SELECT 1 FROM trollmin_queue WHERE user_id = p_user_id AND is_banned_from_queue = true) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Banned from Power Queue');
    END IF;
    
    IF p_coins < v_entry_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not enough coins. Need ' || v_entry_cost);
    END IF;
    
    SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_position FROM trollmin_queue WHERE status = 'waiting';
    
    INSERT INTO trollmin_queue (user_id, username, coins_spent, queue_position, status)
    VALUES (p_user_id, p_username, v_entry_cost, v_position, 'waiting')
    RETURNING jsonb_build_object(
        'success', true,
        'position', queue_position,
        'coins_spent', coins_spent
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCTION: Create new Trollmin (promote from queue)
-- ==========================================
CREATE OR REPLACE FUNCTION promote_next_trollmin()
RETURNS JSONB AS $$
DECLARE
    v_next_queue RECORD;
    v_new_trollmin UUID;
BEGIN
    SELECT * INTO v_next_queue
    FROM trollmin_queue
    WHERE status = 'waiting'
    ORDER BY coins_spent DESC, bid_amount DESC, joined_at ASC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No users in queue');
    END IF;
    
    UPDATE trollmin_current SET is_active = false WHERE is_active = true;
    
    INSERT INTO trollmin_current (user_id, username, started_at, term_days)
    VALUES (v_next_queue.user_id, v_next_queue.username, NOW(), 30)
    RETURNING id INTO v_new_trollmin;
    
    UPDATE trollmin_queue 
    SET status = 'active' 
    WHERE id = v_next_queue.id;
    
    INSERT INTO trollmin_daily_limits (trollmin_id, action_date)
    VALUES (v_new_trollmin, CURRENT_DATE);
    
    RETURN jsonb_build_object(
        'success', true,
        'username', v_next_queue.username,
        'user_id', v_next_queue.user_id,
        'term_days', 30
    );
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCTION: Get active city laws
-- ==========================================
CREATE OR REPLACE FUNCTION get_active_city_laws()
RETURNS TABLE (
    id UUID,
    title VARCHAR,
    description TEXT,
    effect_type VARCHAR,
    effect_value JSONB,
    duration_hours INTEGER,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by_username VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tl.id,
        tl.title,
        tl.description,
        tl.effect_type,
        tl.effect_value,
        tl.duration_hours,
        tl.created_at,
        tl.expires_at,
        tl.created_by_username
    FROM trollmin_laws tl
    WHERE tl.is_active = true 
    AND tl.expires_at > NOW()
    ORDER BY tl.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCTION: Create city law
-- ==========================================
CREATE OR REPLACE FUNCTION create_trollmin_law(
    p_trollmin_id UUID,
    p_title VARCHAR,
    p_description TEXT,
    p_effect_type VARCHAR,
    p_effect_value JSONB,
    p_duration_hours INTEGER,
    p_username VARCHAR
)
RETURNS JSONB AS $$
DECLARE
    v_active_laws_count INTEGER;
    v_result JSONB;
BEGIN
    SELECT COUNT(*) INTO v_active_laws_count
    FROM trollmin_laws
    WHERE is_active = true AND expires_at > NOW();
    
    IF v_active_laws_count >= 3 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum 3 active laws allowed');
    END IF;
    
    INSERT INTO trollmin_laws (
        trollmin_id, title, description, effect_type, effect_value, 
        duration_hours, created_by_username
    )
    VALUES (
        p_trollmin_id, p_title, p_description, p_effect_type, 
        p_effect_value, p_duration_hours, p_username
    )
    RETURNING jsonb_build_object(
        'success', true,
        'id', id,
        'title', title,
        'expires_at', expires_at
    ) INTO v_result;
    
    UPDATE trollmin_current 
    SET actions_count = actions_count + 1, 
        laws_created = laws_created + 1
    WHERE id = p_trollmin_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCTION: Log Trollmin action
-- ==========================================
CREATE OR REPLACE FUNCTION log_trollmin_action(
    p_trollmin_id UUID,
    p_trollmin_username VARCHAR,
    p_action_type VARCHAR,
    p_target_user_id UUID,
    p_target_username VARCHAR,
    p_details JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
    v_action_id UUID;
BEGIN
    INSERT INTO trollmin_actions_log (
        trollmin_id, trollmin_username, action_type,
        target_user_id, target_username, details
    )
    VALUES (
        p_trollmin_id, p_trollmin_username, p_action_type,
        p_target_user_id, p_target_username, p_details
    )
    RETURNING id INTO v_action_id;
    
    UPDATE trollmin_current 
    SET actions_count = actions_count + 1
    WHERE id = p_trollmin_id;
    
    RETURN v_action_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCTION: Get activity feed
-- ==========================================
CREATE OR REPLACE FUNCTION get_trollmin_activity_feed(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    id UUID,
    trollmin_username VARCHAR,
    action_type VARCHAR,
    target_username VARCHAR,
    details JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tal.id,
        tal.trollmin_username,
        tal.action_type,
        tal.target_username,
        tal.details,
        tal.created_at
    FROM trollmin_actions_log tal
    ORDER BY tal.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCTION: Vote for/against Trollmin
-- ==========================================
CREATE OR REPLACE FUNCTION vote_trollmin_approval(
    p_voter_user_id UUID,
    p_trollmin_id UUID,
    p_vote VARCHAR
)
RETURNS JSONB AS $$
DECLARE
    v_existing_vote RECORD;
    v_new_rating INTEGER;
BEGIN
    SELECT * INTO v_existing_vote
    FROM trollmin_approvals
    WHERE voter_user_id = p_voter_user_id 
    AND trollmin_id = p_trollmin_id
    AND DATE(voted_at) = CURRENT_DATE;
    
    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already voted today');
    END IF;
    
    INSERT INTO trollmin_approvals (voter_user_id, trollmin_id, vote)
    VALUES (p_voter_user_id, p_trollmin_id, p_vote);
    
    SELECT (
        SELECT COUNT(*) * 100 / NULLIF(COUNT(*) + COUNT(*) FILTER (WHERE vote = 'down'), 0)
        FROM trollmin_approvals
        WHERE trollmin_id = p_trollmin_id
    )::INTEGER INTO v_new_rating;
    
    UPDATE trollmin_current 
    SET approval_rating = COALESCE(v_new_rating, 50)
    WHERE id = p_trollmin_id;
    
    RETURN jsonb_build_object('success', true, 'new_rating', v_new_rating);
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCTION: Check and enforce daily limits
-- ==========================================
CREATE OR REPLACE FUNCTION check_trollmin_daily_limit(
    p_trollmin_id UUID,
    p_action_type VARCHAR
)
RETURNS JSONB AS $$
DECLARE
    v_limits RECORD;
    v_can_proceed BOOLEAN := false;
    v_current_count INTEGER := 0;
    v_max_count INTEGER := 0;
BEGIN
    SELECT * INTO v_limits
    FROM trollmin_daily_limits
    WHERE trollmin_id = p_trollmin_id AND action_date = CURRENT_DATE;
    
    IF NOT FOUND THEN
        INSERT INTO trollmin_daily_limits (trollmin_id, action_date)
        VALUES (p_trollmin_id, CURRENT_DATE)
        RETURNING * INTO v_limits;
    END IF;
    
    CASE p_action_type
        WHEN 'ban' THEN
            v_max_count := 3;
            v_current_count := v_limits.bans_used;
        WHEN 'mute' THEN
            v_max_count := 5;
            v_current_count := v_limits.mutes_used;
        WHEN 'event' THEN
            v_max_count := 1;
            v_current_count := v_limits.events_used;
        WHEN 'court_override' THEN
            v_max_count := 2;
            v_current_count := v_limits.court_overrides_used;
        ELSE
            v_max_count := 999;
    END CASE;
    
    v_can_proceed := v_current_count < v_max_count;
    
    RETURN jsonb_build_object(
        'success', v_can_proceed,
        'current', v_current_count,
        'max', v_max_count,
        'remaining', GREATEST(0, v_max_count - v_current_count)
    );
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCTION: Use daily limit action
-- ==========================================
CREATE OR REPLACE FUNCTION use_trollmin_daily_limit(
    p_trollmin_id UUID,
    p_action_type VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO trollmin_daily_limits (trollmin_id, action_date)
    VALUES (p_trollmin_id, CURRENT_DATE)
    ON CONFLICT (trollmin_id, action_date) DO NOTHING;
    
    CASE p_action_type
        WHEN 'ban' THEN
            UPDATE trollmin_daily_limits 
            SET bans_used = bans_used + 1 
            WHERE trollmin_id = p_trollmin_id AND action_date = CURRENT_DATE;
            UPDATE trollmin_current SET bans_count = bans_count + 1 WHERE id = p_trollmin_id;
        WHEN 'mute' THEN
            UPDATE trollmin_daily_limits 
            SET mutes_used = mutes_used + 1 
            WHERE trollmin_id = p_trollmin_id AND action_date = CURRENT_DATE;
            UPDATE trollmin_current SET mutes_count = mutes_count + 1 WHERE id = p_trollmin_id;
        WHEN 'event' THEN
            UPDATE trollmin_daily_limits 
            SET events_used = events_used + 1 
            WHERE trollmin_id = p_trollmin_id AND action_date = CURRENT_DATE;
            UPDATE trollmin_current SET events_triggered = events_triggered + 1 WHERE id = p_trollmin_id;
        WHEN 'court_override' THEN
            UPDATE trollmin_daily_limits 
            SET court_overrides_used = court_overrides_used + 1 
            WHERE trollmin_id = p_trollmin_id AND action_date = CURRENT_DATE;
    END CASE;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCTION: End Trollmin term
-- ==========================================
CREATE OR REPLACE FUNCTION end_trollmin_term(p_trollmin_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_trollmin RECORD;
    v_reward_coins INTEGER;
    v_final_rank INTEGER;
BEGIN
    SELECT * INTO v_trollmin FROM trollmin_current WHERE id = p_trollmin_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trollmin not found');
    END IF;
    
    v_reward_coins := (
        v_trollmin.actions_count * 100 +
        v_trollmin.pardons_count * 200 +
        v_trollmin.laws_created * 500 +
        v_trollmin.events_triggered * 1000 +
        v_trollmin.approval_rating * 10
    );
    
    SELECT COUNT(*) + 1 INTO v_final_rank FROM trollmin_term_stats;
    
    INSERT INTO trollmin_term_stats (
        user_id, username, started_at, ended_at, term_days,
        final_approval_rating, total_actions, total_bans, total_mutes,
        total_pardons, laws_created, events_triggered, reward_coins, badge_earned, final_rank
    )
    VALUES (
        v_trollmin.user_id, v_trollmin.username, v_trollmin.started_at, NOW(),
        v_trollmin.term_days, v_trollmin.approval_rating, v_trollmin.actions_count,
        v_trollmin.bans_count, v_trollmin.mutes_count, v_trollmin.pardons_count,
        v_trollmin.laws_created, v_trollmin.events_triggered, v_reward_coins, 
        v_trollmin.approval_rating >= 30, v_final_rank
    );
    
    UPDATE trollmin_current SET is_active = false WHERE id = p_trollmin_id;
    
    UPDATE trollmin_queue 
    SET status = 'completed' 
    WHERE user_id = v_trollmin.user_id AND status = 'active';
    
    PERFORM promote_next_trollmin();
    
    RETURN jsonb_build_object(
        'success', true,
        'reward_coins', v_reward_coins,
        'final_rank', v_final_rank,
        'actions_completed', v_trollmin.actions_count
    );
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCTION: Remove Trollmin (for violations)
-- ==========================================
CREATE OR REPLACE FUNCTION remove_trollmin(p_trollmin_id UUID, p_reason VARCHAR)
RETURNS JSONB AS $$
DECLARE
    v_trollmin RECORD;
BEGIN
    SELECT * INTO v_trollmin FROM trollmin_current WHERE id = p_trollmin_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trollmin not found');
    END IF;
    
    UPDATE trollmin_queue 
    SET is_banned_from_queue = true, status = 'removed'
    WHERE user_id = v_trollmin.user_id;
    
    INSERT INTO trollmin_violations (trollmin_id, violation_type, description, severity)
    VALUES (p_trollmin_id, 'immediate_removal', p_reason, 'critical');
    
    PERFORM end_trollmin_term(p_trollmin_id);
    
    RETURN jsonb_build_object(
        'success', true,
        'username', v_trollmin.username,
        'reason', p_reason
    );
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCTION: Get Trollmin stats
-- ==========================================
CREATE OR REPLACE FUNCTION get_trollmin_stats(p_user_id UUID)
RETURNS TABLE (
    terms_served INTEGER,
    total_actions INTEGER,
    average_approval INTEGER,
    highest_rank INTEGER,
    total_rewards INTEGER,
    badge_earned BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as terms_served,
        COALESCE(SUM(total_actions), 0)::INTEGER as total_actions,
        COALESCE(AVG(final_approval_rating), 0)::INTEGER as average_approval,
        COALESCE(MIN(final_rank), 999)::INTEGER as highest_rank,
        COALESCE(SUM(reward_coins), 0)::INTEGER as total_rewards,
        BOOL_OR(badge_earned) as badge_earned
    FROM trollmin_term_stats
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNCTION: Grant pardon (Trollmin power)
-- ==========================================
CREATE OR REPLACE FUNCTION trollmin_grant_pardon(
    p_trollmin_id UUID,
    p_trollmin_username VARCHAR,
    p_target_user_id UUID,
    p_target_username VARCHAR,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_action_id UUID;
BEGIN
    SELECT log_trollmin_action(
        p_trollmin_id,
        p_trollmin_username,
        'pardon',
        p_target_user_id,
        p_target_username,
        jsonb_build_object('reason', p_reason)
    ) INTO v_action_id;
    
    UPDATE trollmin_current 
    SET actions_count = actions_count + 1,
        pardons_count = pardons_count + 1
    WHERE id = p_trollmin_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'action_id', v_action_id,
        'pardoned', p_target_username
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_current_trollmin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_trollmin_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION join_trollmin_queue(UUID, VARCHAR, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION promote_next_trollmin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_city_laws() TO authenticated;
GRANT EXECUTE ON FUNCTION create_trollmin_law(UUID, VARCHAR, TEXT, VARCHAR, JSONB, INTEGER, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION log_trollmin_action(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trollmin_activity_feed(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION vote_trollmin_approval(UUID, UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION check_trollmin_daily_limit(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION use_trollmin_daily_limit(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION end_trollmin_term(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_trollmin(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trollmin_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION trollmin_grant_pardon(UUID, VARCHAR, UUID, VARCHAR, TEXT) TO authenticated;
