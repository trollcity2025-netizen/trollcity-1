-- =============================================
-- Trollz Giveaway System Database Migration
-- Created: 2026-02-27
-- =============================================

-- =============================================
-- 1. ADD VIP COLUMNS TO USER_PROFILES
-- =============================================

-- Add VIP expiration timestamp
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMPTZ;

-- Add VIP tier (bronze, silver, gold, platinum)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS vip_tier TEXT DEFAULT 'none' CHECK (vip_tier IN ('none', 'bronze', 'silver', 'gold', 'platinum'));

-- Add indexes for VIP columns
CREATE INDEX IF NOT EXISTS idx_user_profiles_vip_expires_at ON user_profiles(vip_expires_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_vip_tier ON user_profiles(vip_tier);

-- =============================================
-- 2. CREATE GIVEAWAYS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS giveaways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    prize_type TEXT NOT NULL CHECK (prize_type IN ('troll_coins', 'vip_badge', 'gift_pack', 'custom')),
    prize_amount INTEGER,  -- For coin prizes (e.g., 1000, 2000)
    prize_tier TEXT,      -- For VIP badges (e.g., 'gold', 'platinum')
    prize_duration_days INTEGER,  -- For VIP badges (e.g., 7, 30)
    gift_pack_discount INTEGER,   -- For gift packs (e.g., 5, 10 for percentage)
    entry_cost_trollz INTEGER NOT NULL DEFAULT 100,
    max_entries INTEGER,  -- Maximum entries per user (null = unlimited)
    allow_free_entry BOOLEAN DEFAULT true,
    min_entries_to_draw INTEGER DEFAULT 1,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_completed BOOLEAN DEFAULT false,
    winner_id UUID REFERENCES user_profiles(id),
    winner_claimed BOOLEAN DEFAULT false,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add check constraint for end_time > start_time
ALTER TABLE giveaways 
ADD CONSTRAINT giveaways_end_time_check 
CHECK (end_time > start_time);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_giveaways_is_active ON giveaways(is_active);
CREATE INDEX IF NOT EXISTS idx_giveaways_is_completed ON giveaways(is_completed);
CREATE INDEX IF NOT EXISTS idx_giveaways_end_time ON giveaways(end_time);
CREATE INDEX IF NOT EXISTS idx_giveaways_prize_type ON giveaways(prize_type);
CREATE INDEX IF NOT EXISTS idx_giveaways_winner_id ON giveaways(winner_id);

-- =============================================
-- 3. CREATE GIVEAWAY_ENTRIES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS giveaway_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    entry_number INTEGER NOT NULL,  -- Which entry this is for the user
    is_free_entry BOOLEAN DEFAULT false,
    trollz_spent INTEGER DEFAULT 0,
    entry_timestamp TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(giveaway_id, user_id, entry_number)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_giveaway_id ON giveaway_entries(giveaway_id);
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user_id ON giveaway_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user_giveaway ON giveaway_entries(user_id, giveaway_id);

-- =============================================
-- 4. CREATE DISCOUNT_CODES TABLE (must be before user_rewards)
-- =============================================

CREATE TABLE IF NOT EXISTS discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    max_uses INTEGER,  -- Maximum total uses (null = unlimited)
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES user_profiles(id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_is_active ON discount_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_discount_codes_valid_until ON discount_codes(valid_until);

-- =============================================
-- 5. CREATE USER_REWARDS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS user_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    giveaway_id UUID REFERENCES giveaways(id) ON DELETE SET NULL,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('troll_coins', 'vip_badge', 'gift_pack')),
    reward_amount INTEGER,
    vip_tier TEXT,
    vip_duration_days INTEGER,
    gift_pack_discount INTEGER,
    discount_code_id UUID REFERENCES discount_codes(id),
    is_claimed BOOLEAN DEFAULT false,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_rewards_user_id ON user_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_giveaway_id ON user_rewards(giveaway_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_is_claimed ON user_rewards(is_claimed);

-- =============================================
-- 5. CREATE DISCOUNT_CODES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    max_uses INTEGER,  -- Maximum total uses (null = unlimited)
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES user_profiles(id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_is_active ON discount_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_discount_codes_valid_until ON discount_codes(valid_until);

-- =============================================
-- 6. ENABLE RLS
-- =============================================

ALTER TABLE giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE giveaway_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- Giveaways RLS Policies
CREATE POLICY "Anyone can view active giveaways" ON giveaways
FOR SELECT USING (is_active = true AND end_time > NOW());

CREATE POLICY "Admins can manage giveaways" ON giveaways
FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Giveaway Entries RLS Policies
CREATE POLICY "Users can view own entries" ON giveaway_entries
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries" ON giveaway_entries
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User Rewards RLS Policies
CREATE POLICY "Users can view own rewards" ON user_rewards
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own rewards insert" ON user_rewards
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rewards claim" ON user_rewards
FOR UPDATE USING (auth.uid() = user_id);

-- Discount Codes RLS Policies
CREATE POLICY "Anyone can view active discount codes" ON discount_codes
FOR SELECT USING (is_active = true AND (valid_until IS NULL OR valid_until > NOW()));

CREATE POLICY "Admins can manage discount codes" ON discount_codes
FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =============================================
-- 7. CREATE RPC FUNCTIONS
-- =============================================

-- Function to get all active giveaways
CREATE OR REPLACE FUNCTION get_active_giveaways()
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    prize_type TEXT,
    prize_amount INTEGER,
    prize_tier TEXT,
    prize_duration_days INTEGER,
    gift_pack_discount INTEGER,
    entry_cost_trollz INTEGER,
    max_entries INTEGER,
    allow_free_entry BOOLEAN,
    end_time TIMESTAMPTZ,
    entry_count BIGINT,
    user_entry_count BIGINT,
    user_has_free_entry BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.title,
        g.description,
        g.prize_type,
        g.prize_amount,
        g.prize_tier,
        g.prize_duration_days,
        g.gift_pack_discount,
        g.entry_cost_trollz,
        g.max_entries,
        g.allow_free_entry,
        g.end_time,
        (SELECT COUNT(*) FROM giveaway_entries WHERE giveaway_id = g.id)::BIGINT AS entry_count,
        COALESCE((SELECT COUNT(*) FROM giveaway_entries WHERE giveaway_id = g.id AND user_id = auth.uid())::BIGINT, 0) AS user_entry_count,
        CASE 
            WHEN g.allow_free_entry AND NOT EXISTS (
                SELECT 1 FROM giveaway_entries 
                WHERE giveaway_id = g.id AND user_id = auth.uid() AND is_free_entry = true
            ) THEN true
            ELSE false
        END AS user_has_free_entry
    FROM giveaways g
    WHERE g.is_active = true 
        AND g.end_time > NOW()
    ORDER BY g.end_time ASC;
END;
$$;

-- Function to enter a giveaway
CREATE OR REPLACE FUNCTION enter_giveaway(
    p_giveaway_id UUID,
    p_use_free_entry BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_giveaway RECORD;
    v_user_id UUID;
    v_current_balance INTEGER;
    v_entry_count INTEGER;
    v_cost INTEGER;
    v_is_free BOOLEAN;
    v_result JSONB;
BEGIN
    -- Get authenticated user
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- Get giveaway details
    SELECT * INTO v_giveaway
    FROM giveaways
    WHERE id = p_giveaway_id;

    IF v_giveaway IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Giveaway not found');
    END IF;

    IF NOT v_giveaway.is_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Giveaway is not active');
    END IF;

    IF v_giveaway.end_time <= NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Giveaway has ended');
    END IF;

    -- Check entry count for this user
    SELECT COUNT(*) INTO v_entry_count
    FROM giveaway_entries
    WHERE giveaway_id = p_giveaway_id AND user_id = v_user_id;

    -- Check max entries
    IF v_giveaway.max_entries IS NOT NULL AND v_entry_count >= v_giveaway.max_entries THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum entries reached');
    END IF;

    -- Determine if using free entry
    v_is_free := p_use_free_entry;
    
    IF v_is_free THEN
        IF NOT v_giveaway.allow_free_entry THEN
            RETURN jsonb_build_object('success', false, 'error', 'Free entry not allowed for this giveaway');
        END IF;

        -- Check if user already used free entry
        IF EXISTS (
            SELECT 1 FROM giveaway_entries 
            WHERE giveaway_id = p_giveaway_id AND user_id = v_user_id AND is_free_entry = true
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Free entry already used');
        END IF;
        
        v_cost := 0;
    ELSE
        -- Get user's trollz balance (server-side validation)
        SELECT COALESCE(trollz_balance, 0) INTO v_current_balance
        FROM user_profiles
        WHERE id = v_user_id;

        v_cost := v_giveaway.entry_cost_trollz;

        IF v_current_balance < v_cost THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'Insufficient Trollz balance',
                'current_balance', v_current_balance,
                'required', v_cost
            );
        END IF;

        -- Deduct Trollz (server-side)
        UPDATE user_profiles
        SET trollz_balance = trollz_balance - v_cost
        WHERE id = v_user_id;

        -- Log transaction
        INSERT INTO trollz_transactions (user_id, amount, type, description, metadata)
        VALUES (
            v_user_id, 
            -v_cost, 
            'giveaway_entry', 
            CONCAT('Entered giveaway: ', v_giveaway.title),
            jsonb_build_object('giveaway_id', p_giveaway_id)
        );
    END IF;

    -- Create entry
    INSERT INTO giveaway_entries (giveaway_id, user_id, entry_number, is_free_entry, trollz_spent)
    VALUES (p_giveaway_id, v_user_id, v_entry_count + 1, v_is_free, v_cost);

    RETURN jsonb_build_object(
        'success', true,
        'entry_number', v_entry_count + 1,
        'cost', v_cost,
        'is_free_entry', v_is_free
    );
END;
$$;

-- Function to select a winner for a giveaway
CREATE OR REPLACE FUNCTION select_giveaway_winner(p_giveaway_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_giveaway RECORD;
    v_entry RECORD;
    v_entries JSONB;
    v_winner_id UUID;
    v_random_num BIGINT;
    v_total_weight INTEGER;
    v_cumulative_weight INTEGER;
    v_selected_weight BIGINT;
BEGIN
    -- Get giveaway details
    SELECT * INTO v_giveaway
    FROM giveaways
    WHERE id = p_giveaway_id;

    IF v_giveaway IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Giveaway not found');
    END IF;

    IF v_giveaway.is_completed THEN
        RETURN jsonb_build_object('success', false, 'error', 'Giveaway already completed');
    END IF;

    -- Check minimum entries
    IF v_giveaway.min_entries_to_draw > 0 THEN
        IF (SELECT COUNT(*) FROM giveaway_entries WHERE giveaway_id = p_giveaway_id) < v_giveaway.min_entries_to_draw THEN
            RETURN jsonb_build_object('success', false, 'error', 'Not enough entries to draw winner');
        END IF;
    END IF;

    -- Weighted random selection based on entries
    -- Each entry gets weight 1 (could be modified for premium entries)
    v_random_num := floor(random() * (SELECT COUNT(*)::BIGINT FROM giveaway_entries WHERE giveaway_id = p_giveaway_id)) + 1;
    
    -- Get the winner by selecting the entry at the random position
    SELECT user_id INTO v_winner_id
    FROM giveaway_entries
    WHERE giveaway_id = p_giveaway_id
    ORDER BY entry_timestamp ASC
    LIMIT 1 OFFSET (v_random_num - 1);

    IF v_winner_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No entries found');
    END IF;

    -- Update giveaway with winner
    UPDATE giveaways
    SET winner_id = v_winner_id, is_completed = true, updated_at = NOW()
    WHERE id = p_giveaway_id;

    -- Create reward record
    INSERT INTO user_rewards (user_id, giveaway_id, reward_type, reward_amount, vip_tier, vip_duration_days, gift_pack_discount)
    VALUES (
        v_winner_id, 
        p_giveaway_id, 
        v_giveaway.prize_type,
        v_giveaway.prize_amount,
        v_giveaway.prize_tier,
        v_giveaway.prize_duration_days,
        v_giveaway.gift_pack_discount
    );

    RETURN jsonb_build_object(
        'success', true,
        'winner_id', v_winner_id,
        'giveaway_id', p_giveaway_id,
        'prize_type', v_giveaway.prize_type,
        'prize_amount', v_giveaway.prize_amount
    );
END;
$$;

-- Function to claim a reward
CREATE OR REPLACE FUNCTION claim_giveaway_reward(p_reward_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reward RECORD;
    v_user_id UUID;
    v_new_balance INTEGER;
    v_discount_code TEXT;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- Get reward details
    SELECT * INTO v_reward
    FROM user_rewards
    WHERE id = p_reward_id AND user_id = v_user_id;

    IF v_reward IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reward not found');
    END IF;

    IF v_reward.is_claimed THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reward already claimed');
    END IF;

    -- Process based on reward type
    IF v_reward.reward_type = 'troll_coins' THEN
        -- Add coins to user profile
        UPDATE user_profiles
        SET troll_coins = COALESCE(troll_coins, 0) + v_reward.reward_amount
        WHERE id = v_user_id;

        -- Log transaction
        INSERT INTO trollz_transactions (user_id, amount, type, description, metadata)
        VALUES (
            v_user_id, 
            v_reward.reward_amount, 
            'giveaway_win', 
            'Won Troll Coins from giveaway',
            jsonb_build_object('reward_id', p_reward_id, 'giveaway_id', v_reward.giveaway_id)
        );

    ELSIF v_reward.reward_type = 'vip_badge' THEN
        -- Update VIP status
        UPDATE user_profiles
        SET 
            vip_tier = v_reward.vip_tier,
            vip_expires_at = CASE 
                WHEN vip_expires_at IS NULL OR vip_expires_at < NOW() THEN NOW() + (v_reward.vip_duration_days || ' days')::INTERVAL
                ELSE vip_expires_at + (v_reward.vip_duration_days || ' days')::INTERVAL
            END
        WHERE id = v_user_id;

    ELSIF v_reward.reward_type = 'gift_pack' THEN
        -- Create discount code for user
        v_discount_code := 'GIFT' || upper(substring(md5(random()::text) from 1 for 8));
        
        INSERT INTO discount_codes (code, discount_percent, max_uses, valid_until, created_by)
        VALUES (
            v_discount_code,
            v_reward.gift_pack_discount,
            1,
            NOW() + INTERVAL '30 days',
            v_user_id
        );
    END IF;

    -- Mark reward as claimed
    UPDATE user_rewards
    SET is_claimed = true, claimed_at = NOW()
    WHERE id = p_reward_id;

    RETURN jsonb_build_object(
        'success', true,
        'reward_type', v_reward.reward_type,
        'reward_amount', v_reward.reward_amount,
        'discount_code', v_discount_code
    );
END;
$$;

-- Function to get user's rewards
CREATE OR REPLACE FUNCTION get_user_rewards()
RETURNS TABLE (
    id UUID,
    reward_type TEXT,
    reward_amount INTEGER,
    vip_tier TEXT,
    vip_duration_days INTEGER,
    gift_pack_discount INTEGER,
    is_claimed BOOLEAN,
    claimed_at TIMESTAMPTZ,
    giveaway_title TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.reward_type,
        r.reward_amount,
        r.vip_tier,
        r.vip_duration_days,
        r.gift_pack_discount,
        r.is_claimed,
        r.claimed_at,
        g.title AS giveaway_title,
        r.created_at
    FROM user_rewards r
    LEFT JOIN giveaways g ON g.id = r.giveaway_id
    WHERE r.user_id = auth.uid()
    ORDER BY r.created_at DESC;
END;
$$;

-- Function to check if user has VIP
CREATE OR REPLACE FUNCTION user_has_vip(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expires_at TIMESTAMPTZ;
BEGIN
    SELECT vip_expires_at INTO v_expires_at
    FROM user_profiles
    WHERE id = p_user_id;

    RETURN v_expires_at IS NOT NULL AND v_expires_at > NOW();
END;
$$;

-- Function to get user's VIP info
CREATE OR REPLACE FUNCTION get_user_vip_info(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tier TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    SELECT vip_tier, vip_expires_at INTO v_tier, v_expires_at
    FROM user_profiles
    WHERE id = p_user_id;

    IF v_expires_at IS NULL OR v_expires_at <= NOW() THEN
        RETURN jsonb_build_object(
            'is_vip', false,
            'tier', 'none',
            'expires_at', null
        );
    END IF;

    RETURN jsonb_build_object(
        'is_vip', true,
        'tier', v_tier,
        'expires_at', v_expires_at
    );
END;
$$;

-- =============================================
-- 8. SEED DEFAULT GIVEAWAYS (for testing)
-- =============================================

-- Insert sample giveaways (can be removed in production)
INSERT INTO giveaways (title, description, prize_type, prize_amount, entry_cost_trollz, end_time, allow_free_entry)
VALUES 
    ('1,000 Troll Coins Giveaway', 'Win 1,000 free Troll Coins!', 'troll_coins', 1000, 100, NOW() + INTERVAL '7 days', true),
    ('2,000 Troll Coins Giveaway', 'Win 2,000 free Troll Coins!', 'troll_coins', 2000, 200, NOW() + INTERVAL '7 days', true),
    ('7-Day VIP Badge', 'Win a 7-day VIP badge!', 'vip_badge', NULL, 300, NOW() + INTERVAL '7 days', true),
    ('30-Day VIP Gold', 'Win a 30-day Gold VIP badge!', 'vip_badge', NULL, 500, NOW() + INTERVAL '7 days', true),
    ('5% Gift Pack', 'Get a 5% discount on Coin Store!', 'gift_pack', NULL, 150, NOW() + INTERVAL '7 days', true),
    ('10% Gift Pack', 'Get a 10% discount on Coin Store!', 'gift_pack', NULL, 250, NOW() + INTERVAL '7 days', true)
ON CONFLICT DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE giveaways IS 'Stores all giveaway campaigns';
COMMENT ON TABLE giveaway_entries IS 'Tracks user entries for each giveaway';
COMMENT ON TABLE user_rewards IS 'Stores rewards won by users from giveaways';
COMMENT ON TABLE discount_codes IS 'Discount codes for gift packs';
COMMENT ON COLUMN user_profiles.vip_expires_at IS 'VIP badge expiration timestamp';
COMMENT ON COLUMN user_profiles.vip_tier IS 'VIP tier (none, bronze, silver, gold, platinum)';
