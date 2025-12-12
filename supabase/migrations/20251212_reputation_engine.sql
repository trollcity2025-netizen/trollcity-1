-- Reputation Engine - Internal scoring system for users, officers, and sellers
-- Scores influence escalation priority, scheduling, and platform behavior

-- User reputation scores table
CREATE TABLE IF NOT EXISTS user_reputation (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    current_score INTEGER DEFAULT 100, -- Base score of 100
    lifetime_score INTEGER DEFAULT 100,
    violations_count INTEGER DEFAULT 0,
    court_appearances INTEGER DEFAULT 0,
    missed_court_sessions INTEGER DEFAULT 0,
    successful_appeals INTEGER DEFAULT 0,
    last_violation_date TIMESTAMPTZ,
    reputation_tier VARCHAR(20) DEFAULT 'good', -- 'excellent', 'good', 'warning', 'poor', 'banned'
    is_escalation_priority BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_reputation UNIQUE (user_id)
);

-- Officer performance scores table
CREATE TABLE IF NOT EXISTS officer_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    current_score INTEGER DEFAULT 100,
    lifetime_score INTEGER DEFAULT 100,
    cases_handled INTEGER DEFAULT 0,
    successful_resolutions INTEGER DEFAULT 0,
    escalated_cases INTEGER DEFAULT 0,
    average_resolution_time_minutes INTEGER,
    owc_points_earned INTEGER DEFAULT 0,
    performance_rating VARCHAR(20) DEFAULT 'standard', -- 'elite', 'excellent', 'good', 'standard', 'needs_improvement'
    specialization_areas TEXT[], -- Areas they're good at
    last_case_date TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_officer_performance UNIQUE (officer_id)
);

-- Seller reliability scores table
CREATE TABLE IF NOT EXISTS seller_reliability (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    current_score INTEGER DEFAULT 100,
    lifetime_score INTEGER DEFAULT 100,
    orders_fulfilled INTEGER DEFAULT 0,
    orders_cancelled INTEGER DEFAULT 0,
    disputes_raised INTEGER DEFAULT 0,
    disputes_won INTEGER DEFAULT 0, -- As seller
    refunds_processed INTEGER DEFAULT 0,
    average_fulfillment_time_hours INTEGER,
    reliability_tier VARCHAR(20) DEFAULT 'standard', -- 'platinum', 'gold', 'silver', 'standard', 'suspended'
    is_high_risk BOOLEAN DEFAULT FALSE,
    last_order_date TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_seller_reliability UNIQUE (seller_id)
);

-- Reputation events log - tracks all score changes
CREATE TABLE IF NOT EXISTS reputation_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    target_id UUID NOT NULL, -- user_id, officer_id, or seller_id
    reputation_type VARCHAR(20) NOT NULL, -- 'user', 'officer', 'seller'
    event_type VARCHAR(50) NOT NULL,
    score_change INTEGER NOT NULL,
    previous_score INTEGER,
    new_score INTEGER,
    reason TEXT,
    triggered_by UUID REFERENCES user_profiles(id), -- Who caused this change
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_reputation_user_id ON user_reputation(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reputation_tier ON user_reputation(reputation_tier);
CREATE INDEX IF NOT EXISTS idx_user_reputation_priority ON user_reputation(is_escalation_priority);

CREATE INDEX IF NOT EXISTS idx_officer_performance_officer_id ON officer_performance(officer_id);
CREATE INDEX IF NOT EXISTS idx_officer_performance_rating ON officer_performance(performance_rating);

CREATE INDEX IF NOT EXISTS idx_seller_reliability_seller_id ON seller_reliability(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_reliability_tier ON seller_reliability(reliability_tier);
CREATE INDEX IF NOT EXISTS idx_seller_reliability_risk ON seller_reliability(is_high_risk);

CREATE INDEX IF NOT EXISTS idx_reputation_events_target_id ON reputation_events(target_id);
CREATE INDEX IF NOT EXISTS idx_reputation_events_type ON reputation_events(reputation_type);
CREATE INDEX IF NOT EXISTS idx_reputation_events_created_at ON reputation_events(created_at DESC);

-- RLS Policies (admins and officers can read, only system can write)
ALTER TABLE user_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE officer_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_reliability ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reputation read access" ON user_reputation
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

CREATE POLICY "Officer performance read access" ON officer_performance
    FOR SELECT USING (
        officer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role = 'admin' OR is_admin = true)
        )
    );

CREATE POLICY "Seller reliability read access" ON seller_reliability
    FOR SELECT USING (
        seller_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

CREATE POLICY "Reputation events read access" ON reputation_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (role IN ('admin', 'troll_officer') OR is_admin = true OR is_troll_officer = true)
        )
    );

-- Functions for reputation management
CREATE OR REPLACE FUNCTION update_user_reputation(
    p_user_id UUID,
    p_score_change INTEGER,
    p_event_type VARCHAR(50),
    p_reason TEXT DEFAULT NULL,
    p_triggered_by UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
DECLARE
    old_score INTEGER;
    new_score INTEGER;
    new_tier VARCHAR(20);
BEGIN
    -- Get current score
    SELECT current_score INTO old_score
    FROM user_reputation
    WHERE user_id = p_user_id;

    -- If no record exists, create one
    IF old_score IS NULL THEN
        INSERT INTO user_reputation (user_id, current_score, lifetime_score)
        VALUES (p_user_id, 100, 100);
        old_score := 100;
    END IF;

    -- Calculate new score (minimum 0)
    new_score := GREATEST(0, old_score + p_score_change);

    -- Update reputation record
    UPDATE user_reputation
    SET
        current_score = new_score,
        lifetime_score = lifetime_score + p_score_change,
        updated_at = NOW(),
        reputation_tier = CASE
            WHEN new_score >= 150 THEN 'excellent'
            WHEN new_score >= 100 THEN 'good'
            WHEN new_score >= 50 THEN 'warning'
            WHEN new_score >= 10 THEN 'poor'
            ELSE 'banned'
        END,
        is_escalation_priority = (new_score < 50)
    WHERE user_id = p_user_id;

    -- Update violation tracking based on event type
    IF p_event_type IN ('violation', 'court_outcome') THEN
        UPDATE user_reputation
        SET
            violations_count = violations_count + 1,
            last_violation_date = NOW()
        WHERE user_id = p_user_id;
    END IF;

    -- Log the reputation event
    INSERT INTO reputation_events (
        target_id, reputation_type, event_type, score_change,
        previous_score, new_score, reason, triggered_by, metadata
    ) VALUES (
        p_user_id, 'user', p_event_type, p_score_change,
        old_score, new_score, p_reason, p_triggered_by, p_metadata
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_officer_performance(
    p_officer_id UUID,
    p_score_change INTEGER,
    p_event_type VARCHAR(50),
    p_reason TEXT DEFAULT NULL,
    p_triggered_by UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
DECLARE
    old_score INTEGER;
    new_score INTEGER;
    new_rating VARCHAR(20);
BEGIN
    -- Get current score
    SELECT current_score INTO old_score
    FROM officer_performance
    WHERE officer_id = p_officer_id;

    -- If no record exists, create one
    IF old_score IS NULL THEN
        INSERT INTO officer_performance (officer_id, current_score, lifetime_score)
        VALUES (p_officer_id, 100, 100);
        old_score := 100;
    END IF;

    -- Calculate new score (minimum 0)
    new_score := GREATEST(0, old_score + p_score_change);

    -- Determine rating based on score
    new_rating := CASE
        WHEN new_score >= 150 THEN 'elite'
        WHEN new_score >= 120 THEN 'excellent'
        WHEN new_score >= 90 THEN 'good'
        WHEN new_score >= 70 THEN 'standard'
        ELSE 'needs_improvement'
    END;

    -- Update performance record
    UPDATE officer_performance
    SET
        current_score = new_score,
        lifetime_score = lifetime_score + p_score_change,
        performance_rating = new_rating,
        updated_at = NOW()
    WHERE officer_id = p_officer_id;

    -- Log the performance event
    INSERT INTO reputation_events (
        target_id, reputation_type, event_type, score_change,
        previous_score, new_score, reason, triggered_by, metadata
    ) VALUES (
        p_officer_id, 'officer', p_event_type, p_score_change,
        old_score, new_score, p_reason, p_triggered_by, p_metadata
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_seller_reliability(
    p_seller_id UUID,
    p_score_change INTEGER,
    p_event_type VARCHAR(50),
    p_reason TEXT DEFAULT NULL,
    p_triggered_by UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
DECLARE
    old_score INTEGER;
    new_score INTEGER;
    new_tier VARCHAR(20);
BEGIN
    -- Get current score
    SELECT current_score INTO old_score
    FROM seller_reliability
    WHERE seller_id = p_seller_id;

    -- If no record exists, create one
    IF old_score IS NULL THEN
        INSERT INTO seller_reliability (seller_id, current_score, lifetime_score)
        VALUES (p_seller_id, 100, 100);
        old_score := 100;
    END IF;

    -- Calculate new score (minimum 0)
    new_score := GREATEST(0, old_score + p_score_change);

    -- Determine tier based on score
    new_tier := CASE
        WHEN new_score >= 150 THEN 'platinum'
        WHEN new_score >= 120 THEN 'gold'
        WHEN new_score >= 90 THEN 'silver'
        WHEN new_score >= 70 THEN 'standard'
        ELSE 'suspended'
    END;

    -- Update reliability record
    UPDATE seller_reliability
    SET
        current_score = new_score,
        lifetime_score = lifetime_score + p_score_change,
        reliability_tier = new_tier,
        is_high_risk = (new_score < 50),
        updated_at = NOW()
    WHERE seller_id = p_seller_id;

    -- Log the reliability event
    INSERT INTO reputation_events (
        target_id, reputation_type, event_type, score_change,
        previous_score, new_score, reason, triggered_by, metadata
    ) VALUES (
        p_seller_id, 'seller', p_event_type, p_score_change,
        old_score, new_score, p_reason, p_triggered_by, p_metadata
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get reputation summary for a user
CREATE OR REPLACE FUNCTION get_user_reputation_summary(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'current_score', current_score,
        'lifetime_score', lifetime_score,
        'reputation_tier', reputation_tier,
        'violations_count', violations_count,
        'court_appearances', court_appearances,
        'missed_court_sessions', missed_court_sessions,
        'is_escalation_priority', is_escalation_priority,
        'last_violation_date', last_violation_date
    ) INTO result
    FROM user_reputation
    WHERE user_id = p_user_id;

    RETURN COALESCE(result, jsonb_build_object(
        'current_score', 100,
        'lifetime_score', 100,
        'reputation_tier', 'good',
        'violations_count', 0,
        'court_appearances', 0,
        'missed_court_sessions', 0,
        'is_escalation_priority', false,
        'last_violation_date', null
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get officer performance summary
CREATE OR REPLACE FUNCTION get_officer_performance_summary(p_officer_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'current_score', current_score,
        'lifetime_score', lifetime_score,
        'performance_rating', performance_rating,
        'cases_handled', cases_handled,
        'successful_resolutions', successful_resolutions,
        'owc_points_earned', owc_points_earned,
        'last_case_date', last_case_date
    ) INTO result
    FROM officer_performance
    WHERE officer_id = p_officer_id;

    RETURN COALESCE(result, jsonb_build_object(
        'current_score', 100,
        'lifetime_score', 100,
        'performance_rating', 'standard',
        'cases_handled', 0,
        'successful_resolutions', 0,
        'owc_points_earned', 0,
        'last_case_date', null
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get seller reliability summary
CREATE OR REPLACE FUNCTION get_seller_reliability_summary(p_seller_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'current_score', current_score,
        'lifetime_score', lifetime_score,
        'reliability_tier', reliability_tier,
        'orders_fulfilled', orders_fulfilled,
        'orders_cancelled', orders_cancelled,
        'disputes_raised', disputes_raised,
        'is_high_risk', is_high_risk,
        'last_order_date', last_order_date
    ) INTO result
    FROM seller_reliability
    WHERE seller_id = p_seller_id;

    RETURN COALESCE(result, jsonb_build_object(
        'current_score', 100,
        'lifetime_score', 100,
        'reliability_tier', 'standard',
        'orders_fulfilled', 0,
        'orders_cancelled', 0,
        'disputes_raised', 0,
        'is_high_risk', false,
        'last_order_date', null
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;