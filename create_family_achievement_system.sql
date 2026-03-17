-- =============================================================================
-- TROLL FAMILIES ACHIEVEMENT & PROGRESSION SYSTEM
-- Complete achievement tiers, scaling formulas, and progression mechanics
-- =============================================================================

-- =============================================================================
-- ENHANCED FAMILY STATS TABLE (for aggregated tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_stats_enhanced (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID UNIQUE REFERENCES public.troll_families(id) ON DELETE CASCADE,
    
    -- Aggregated stats (updated via batch jobs, not real-time)
    total_messages BIGINT DEFAULT 0,
    total_calls BIGINT DEFAULT 0,
    total_call_minutes BIGINT DEFAULT 0,
    total_coins BIGINT DEFAULT 0,
    total_gifts BIGINT DEFAULT 0,
    total_gift_value BIGINT DEFAULT 0,
    total_battle_wins BIGINT DEFAULT 0,
    total_battles BIGINT DEFAULT 0,
    total_streams BIGINT DEFAULT 0,
    total_stream_minutes BIGINT DEFAULT 0,
    total_invites BIGINT DEFAULT 0,
    active_days INTEGER DEFAULT 0,
    
    -- Level & XP
    level INTEGER DEFAULT 1,
    xp BIGINT DEFAULT 0,
    xp_to_next_level BIGINT DEFAULT 1000,
    
    -- Streaks
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    
    -- Tier progress
    current_tier INTEGER DEFAULT 1,
    tier_completed_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_family_stats_enhanced_family ON public.family_stats_enhanced(family_id);
CREATE INDEX idx_family_stats_enhanced_level ON public.family_stats_enhanced(level DESC);

-- =============================================================================
-- ACHIEVEMENT TIERS CONFIGURATION
-- Dynamically generated achievements based on tier
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.achievement_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_number INTEGER UNIQUE NOT NULL,
    tier_name TEXT NOT NULL,
    tier_description TEXT,
    tier_color TEXT DEFAULT '#FFD700',
    tier_icon TEXT,
    
    -- Base values for scaling formulas
    base_messages INTEGER DEFAULT 50,
    base_calls INTEGER DEFAULT 1,
    base_coins INTEGER DEFAULT 1000,
    base_gifts INTEGER DEFAULT 1,
    base_battles INTEGER DEFAULT 1,
    base_invites INTEGER DEFAULT 1,
    base_streak_days INTEGER DEFAULT 1,
    base_members INTEGER DEFAULT 3,
    
    -- XP rewards
    xp_reward INTEGER DEFAULT 100,
    bonus_xp INTEGER DEFAULT 50,
    
    -- Coin rewards
    coin_reward INTEGER DEFAULT 500,
    bonus_coins INTEGER DEFAULT 250,
    
    -- Unlock requirements
    required_tier INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ACHIEVEMENT DEFINITIONS (auto-generated per tier)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.achievement_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    achievement_key TEXT UNIQUE NOT NULL,
    tier_id UUID REFERENCES public.achievement_tiers(id),
    tier_number INTEGER NOT NULL,
    
    -- Achievement details
    title TEXT NOT NULL,
    description TEXT,
    hint TEXT, -- Shown before unlock
    secret BOOLEAN DEFAULT false, -- Hidden until unlocked
    
    -- Metric type for tracking
    metric_type TEXT NOT NULL, -- messages, calls, coins, gifts, battles, invites, streak, members
    
    -- Base requirement (scaled by tier)
    base_requirement INTEGER NOT NULL,
    requirement_multiplier FLOAT DEFAULT 1.0,
    
    -- Scaling formula: requirement = base * (tier ^ multiplier)
    tier_multiplier FLOAT DEFAULT 1.0,
    
    -- Rewards
    xp_reward INTEGER DEFAULT 100,
    coin_reward INTEGER DEFAULT 500,
    badge_id UUID,
    
    -- Display
    icon TEXT,
    color TEXT,
    rarity TEXT DEFAULT 'common', -- common, uncommon, rare, epic, legendary, mythic
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_achievement_definitions_tier ON public.achievement_definitions(tier_number);
CREATE INDEX idx_achievement_definitions_metric ON public.achievement_definitions(metric_type);
CREATE INDEX idx_achievement_definitions_secret ON public.achievement_definitions(secret) WHERE secret = true;

-- =============================================================================
-- FAMILY ACHIEVEMENTS (instance per family)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_achievements_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.troll_families(id) ON DELETE CASCADE,
    achievement_key TEXT NOT NULL,
    progress BIGINT DEFAULT 0,
    target BIGINT NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    xp_awarded INTEGER DEFAULT 0,
    coins_awarded INTEGER DEFAULT 0,
    
    UNIQUE(family_id, achievement_key)
);

CREATE INDEX idx_family_achievements_new_family ON public.family_achievements_new(family_id);
CREATE INDEX idx_family_achievements_new_completed ON public.family_achievements_new(completed) WHERE completed = false;

-- =============================================================================
-- WEEKLY FAMILY GOALS (auto-generated & rotating)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.weekly_family_goals_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.troll_families(id) ON DELETE CASCADE,
    goal_key TEXT NOT NULL,
    
    -- Goal details
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- messages, calls, coins, gifts, battles, invites
    difficulty TEXT DEFAULT 'medium', -- easy, medium, hard, elite
    
    -- Progress tracking
    progress BIGINT DEFAULT 0,
    target BIGINT NOT NULL,
    previous_best BIGINT DEFAULT 0,
    
    -- Rewards
    xp_reward INTEGER DEFAULT 200,
    coin_reward INTEGER DEFAULT 1000,
    
    -- Week tracking
    week_number INTEGER NOT NULL,
    year INTEGER NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    
    UNIQUE(family_id, goal_key, week_number, year)
);

CREATE INDEX idx_weekly_goals_family ON public.weekly_family_goals_new(family_id);
CREATE INDEX idx_weekly_goals_week ON public.weekly_family_goals_new(week_number, year);
CREATE INDEX idx_weekly_goals_expires ON public.weekly_family_goals_new(expires_at);

-- =============================================================================
-- HIDDEN ACHIEVEMENTS (secret triggers)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.hidden_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    achievement_key TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    secret_hint TEXT, -- Shown when unlocked
    
    -- Trigger conditions (stored as JSON)
    trigger_type TEXT NOT NULL, -- event_count, time_based, streak, special
    trigger_config JSONB NOT NULL, -- {event: 'call_join', count: 10, timeframe: 'hour'}
    
    -- Rewards
    xp_reward INTEGER DEFAULT 500,
    coin_reward INTEGER DEFAULT 2500,
    exclusive_badge TEXT,
    
    -- Rarity
    rarity TEXT DEFAULT 'legendary',
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- FAMILY LEVEL UNLOCKS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_level_unlocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level INTEGER UNIQUE NOT NULL,
    
    -- Unlock details
    unlock_type TEXT NOT NULL, -- theme, badge, effect, feature
    unlock_key TEXT NOT NULL,
    unlock_name TEXT NOT NULL,
    unlock_description TEXT,
    
    -- Visual
    icon TEXT,
    color TEXT,
    
    is_active BOOLEAN DEFAULT true
);

-- =============================================================================
-- FAMILY EVENT RATE LIMITS (anti-spam)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES public.troll_families(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Rate limit tracking
    event_type TEXT NOT NULL, -- message, gift, call
    count INTEGER DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL,
    window_duration INTEGER DEFAULT 60, -- seconds
    
    -- Limits per type
    max_per_minute INTEGER DEFAULT 10,
    max_per_hour INTEGER DEFAULT 100,
    
    UNIQUE(family_id, user_id, event_type)
);

CREATE INDEX idx_family_rate_limits ON public.family_rate_limits(family_id, user_id, event_type);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================
ALTER TABLE public.family_stats_enhanced ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_achievements_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_family_goals_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hidden_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_level_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_rate_limits ENABLE ROW LEVEL SECURITY;

-- Family stats: members can view
CREATE POLICY "Family members can view enhanced stats" ON public.family_stats_enhanced
    FOR SELECT USING (family_id IN (
        SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
    ));

-- Achievement tiers: public read
CREATE POLICY "Achievement tiers public read" ON public.achievement_tiers
    FOR SELECT USING (true);

-- Achievement definitions: public read
CREATE POLICY "Achievement definitions public read" ON public.achievement_definitions
    FOR SELECT USING (true);

-- Family achievements: members can view
CREATE POLICY "Family members can view achievements" ON public.family_achievements_new
    FOR SELECT USING (family_id IN (
        SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
    ));

-- Weekly goals: members can view
CREATE POLICY "Family members can view weekly goals" ON public.weekly_family_goals_new
    FOR SELECT USING (family_id IN (
        SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
    ));

-- Hidden achievements: public read (locked ones hidden via query)
CREATE POLICY "Hidden achievements public read" ON public.hidden_achievements
    FOR SELECT USING (true);

-- Family level unlocks: public read
CREATE POLICY "Family level unlocks public read" ON public.family_level_unlocks
    FOR SELECT USING (true);

-- Rate limits: owner only
CREATE POLICY "Rate limits owner only" ON public.family_rate_limits
    FOR ALL USING (
        user_id = auth.uid() OR 
        family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role = 'leader')
    );

-- =============================================================================
-- SEED ACHIEVEMENT TIERS (Tier 1-16 with scaling formulas)
-- =============================================================================
INSERT INTO public.achievement_tiers (
    tier_number, tier_name, tier_description, tier_color, tier_icon,
    base_messages, base_calls, base_coins, base_gifts, base_battles, base_invites, base_streak_days, base_members,
    xp_reward, bonus_xp, coin_reward, bonus_coins, required_tier
) VALUES
    (1, 'Getting Started', 'Begin your family journey', '#4CAF50', '🌱',
     50, 1, 1000, 1, 1, 1, 1, 3,
     100, 50, 500, 250, 0),
    
    (2, 'Building Up', 'Grow your family presence', '#2196F3', '🏠',
     100, 2, 2500, 3, 2, 2, 3, 5,
     200, 100, 1000, 500, 1),
    
    (3, 'Making Friends', 'Connect with the community', '#9C27B0', '🤝',
     200, 5, 5000, 5, 3, 3, 5, 7,
     300, 150, 1500, 750, 2),
    
    (4, 'Growing Strong', 'Your family is getting noticed', '#FF9800', '💪',
     400, 10, 10000, 10, 5, 5, 7, 10,
     500, 250, 2500, 1250, 3),
    
    (5, 'Popular', 'People know your family', '#E91E63', '⭐',
     750, 20, 20000, 20, 8, 8, 10, 15,
     750, 375, 4000, 2000, 4),
    
    (6, 'Trending', 'Your family is trending', '#00BCD4', '📈',
     1200, 35, 35000, 35, 12, 12, 14, 20,
     1000, 500, 6000, 3000, 5),
    
    (7, 'Competitive', 'Ready for the big leagues', '#3F51B5', '🎯',
     2000, 50, 50000, 50, 18, 18, 21, 25,
     1500, 750, 10000, 5000, 6),
    
    (8, 'Elite', 'Among the best families', '#673AB7', '👑',
     3500, 75, 75000, 75, 25, 25, 30, 30,
     2000, 1000, 15000, 7500, 7),
    
    (9, 'Champion', 'Top-tier family', '#FFC107', '🏆',
     5000, 100, 100000, 100, 35, 35, 45, 40,
     3000, 1500, 25000, 12500, 8),
    
    (10, 'Legendary', 'Legendary status achieved', '#FF5722', '🔥',
     7500, 150, 150000, 150, 50, 50, 60, 50,
     4000, 2000, 40000, 20000, 9),
    
    (11, 'Mythic', 'Above legendary', '#9E9E9E', '💎',
     10000, 200, 200000, 200, 70, 70, 80, 60,
     5000, 2500, 60000, 30000, 10),
    
    (12, 'Immortal', 'Forever in Troll City history', '#795548', '🌟',
     15000, 300, 300000, 300, 100, 100, 100, 75,
     7500, 3750, 100000, 50000, 11),
    
    (13, 'Divine', 'Touched by the gods', '#607D8B', '✨',
     25000, 450, 500000, 500, 150, 150, 130, 100,
     10000, 5000, 175000, 87500, 12),
    
    (14, 'Cosmic', 'Beyond mortal comprehension', '#3F51B5', '🌌',
     40000, 650, 750000, 750, 225, 225, 170, 125,
     15000, 7500, 300000, 150000, 13),
    
    (15, 'Universal', 'A force to be reckoned with', '#000000', '🌍',
     60000, 1000, 1000000, 1000, 350, 350, 220, 150,
     25000, 12500, 500000, 250000, 14),
    
    (16, 'Omnipotent', 'Absolute power', '#FFD700', '⚡',
     100000, 1500, 2000000, 2000, 500, 500, 300, 200,
     50000, 25000, 1000000, 500000, 15)
ON CONFLICT (tier_number) DO NOTHING;

-- =============================================================================
-- SEED ACHIEVEMENT DEFINITIONS (auto-generated based on tier)
-- =============================================================================
INSERT INTO public.achievement_definitions (
    achievement_key, tier_number, title, description, hint, secret,
    metric_type, base_requirement, requirement_multiplier, tier_multiplier,
    xp_reward, coin_reward, icon, color, rarity
) VALUES
    -- TIER 1: Getting Started
    ('tier1_messages', 1, 'First Words', 'Send your first 50 family messages', 'Start chatting with family!', false,
     'messages', 50, 1.0, 1.0, 100, 500, '💬', '#4CAF50', 'common'),
    ('tier1_call', 1, 'First Call', 'Join your first family voice call', 'Start a voice call!', false,
     'calls', 1, 1.0, 1.0, 100, 500, '📞', '#4CAF50', 'common'),
    ('tier1_coins', 1, 'Family Purse', 'Earn 1,000 coins for the family', 'Send gifts to earn coins!', false,
     'coins', 1000, 1.0, 1.0, 100, 500, '💰', '#4CAF50', 'common'),
    ('tier1_members', 1, 'Growing Family', 'Reach 3 family members', 'Invite friends to join!', false,
     'members', 3, 1.0, 1.0, 100, 500, '👨‍👩‍👧', '#4CAF50', 'common'),
    ('tier1_streak', 1, 'First Steps', 'Maintain a 1-day activity streak', 'Be active every day!', false,
     'streak', 1, 1.0, 1.0, 100, 500, '🔥', '#4CAF50', 'common'),
    
    -- TIER 2: Building Up
    ('tier2_messages', 2, 'Chatty Family', 'Send 100 messages', 'Keep the conversation going!', false,
     'messages', 100, 1.0, 1.5, 200, 1000, '💬', '#2196F3', 'common'),
    ('tier2_calls', 2, 'Stay Connected', 'Make 2 voice calls', 'Talk with family!', false,
     'calls', 2, 1.0, 1.5, 200, 1000, '📞', '#2196F3', 'common'),
    ('tier2_coins', 2, 'Family Fortune', 'Earn 2,500 coins', 'Gifts generate coins!', false,
     'coins', 2500, 1.0, 1.8, 200, 1000, '💰', '#2196F3', 'common'),
    ('tier2_members', 2, 'Extended Family', 'Reach 5 members', 'Invite more friends!', false,
     'members', 5, 1.0, 1.2, 200, 1000, '👨‍👩‍👧', '#2196F3', 'common'),
    ('tier2_streak', 2, 'Consistent', '3-day activity streak', 'Stay active daily!', false,
     'streak', 3, 1.0, 1.3, 200, 1000, '🔥', '#2196F3', 'common'),
    ('tier2_gifts', 2, 'Gift Givers', 'Send 3 gifts as a family', 'Spread the love!', false,
     'gifts', 3, 1.0, 1.5, 200, 1000, '🎁', '#2196F3', 'common'),
    
    -- TIER 3: Making Friends
    ('tier3_messages', 3, 'Communication Masters', 'Send 200 messages', 'The family that chats together...', false,
     'messages', 200, 1.0, 2.0, 300, 1500, '💬', '#9C27B0', 'uncommon'),
    ('tier3_calls', 3, 'Always Talking', 'Make 5 calls', 'Keep those connections strong!', false,
     'calls', 5, 1.0, 2.0, 300, 1500, '📞', '#9C27B0', 'uncommon'),
    ('tier3_coins', 3, 'Wealth Building', 'Earn 5,000 coins', 'Your family is prospering!', false,
     'coins', 5000, 1.0, 2.0, 300, 1500, '💰', '#9C27B0', 'uncommon'),
    ('tier3_battles', 3, 'First Victory', 'Win your first family battle', 'Test your might!', false,
     'battles', 1, 1.0, 1.5, 300, 1500, '⚔️', '#9C27B0', 'uncommon'),
    ('tier3_invites', 3, 'Recruiter', 'Invite 3 new members', 'Bring in new blood!', false,
     'invites', 3, 1.0, 1.8, 300, 1500, '📨', '#9C27B0', 'uncommon'),
    ('tier3_streak', 3, 'Week Warriors', '5-day activity streak', 'A full week of dedication!', false,
     'streak', 5, 1.0, 1.5, 300, 1500, '🔥', '#9C27B0', 'uncommon'),
    
    -- TIER 4-16 follow similar pattern with scaling
    -- (simplified for brevity, system generates dynamically)
    
    ('tier4_messages', 4, 'Message Dynasty', 'Send 400 messages', 'A messaging empire!', false,
     'messages', 400, 1.0, 2.2, 500, 2500, '💬', '#FF9800', 'uncommon'),
    ('tier4_calls', 4, 'Call Legends', 'Make 10 calls', 'Always connected!', false,
     'calls', 10, 1.0, 2.2, 500, 2500, '📞', '#FF9800', 'uncommon'),
    ('tier4_battles', 4, 'Battle Hardened', 'Win 5 battles', 'Victory is yours!', false,
     'battles', 5, 1.0, 2.0, 500, 2500, '⚔️', '#FF9800', 'uncommon'),
    ('tier4_members', 4, 'Big Family', 'Reach 10 members', 'A growing community!', false,
     'members', 10, 1.0, 1.5, 500, 2500, '👨‍👩‍👧', '#FF9800', 'uncommon'),
    
    ('tier5_messages', 5, 'Message Masters', 'Send 750 messages', 'Unstoppable chat!', false,
     'messages', 750, 1.0, 2.5, 750, 4000, '💬', '#E91E63', 'rare'),
    ('tier5_battles', 5, 'Warlords', 'Win 8 battles', 'Conquer all rivals!', false,
     'battles', 8, 1.0, 2.2, 750, 4000, '⚔️', '#E91E63', 'rare'),
    ('tier5_gifts', 5, 'Generous Hearts', 'Send 20 gifts', 'Give generously!', false,
     'gifts', 20, 1.0, 2.0, 750, 4000, '🎁', '#E91E63', 'rare'),
    ('tier5_streak', 5, 'Tenacious', '10-day streak', 'Two weeks strong!', false,
     'streak', 10, 1.0, 1.8, 750, 4000, '🔥', '#E91E63', 'rare'),
    
    -- Continue pattern for tiers 6-16...
    ('tier6_messages', 6, 'Message Monarchs', 'Send 1,200 messages', 'Royal communication!', false,
     'messages', 1200, 1.0, 2.7, 1000, 6000, '💬', '#00BCD4', 'rare'),
    ('tier7_messages', 7, 'Elite Communicators', 'Send 2,000 messages', 'Top-tier chatter!', false,
     'messages', 2000, 1.0, 2.8, 1500, 10000, '💬', '#3F51B5', 'epic'),
    ('tier8_messages', 8, 'Supreme Senders', 'Send 3,500 messages', 'Ultimate messaging!', false,
     'messages', 3500, 1.0, 3.0, 2000, 15000, '💬', '#673AB7', 'epic'),
    ('tier9_messages', 9, 'Champions of Chat', 'Send 5,000 messages', 'Hall of fame material!', false,
     'messages', 5000, 1.0, 3.2, 3000, 25000, '💬', '#FFC107', 'legendary'),
    ('tier10_messages', 10, 'Legendary Speakers', 'Send 7,500 messages', 'Living legends!', false,
     'messages', 7500, 1.0, 3.5, 4000, 40000, '💬', '#FF5722', 'legendary')
ON CONFLICT (achievement_key) DO NOTHING;

-- =============================================================================
-- SEED HIDDEN ACHIEVEMENTS
-- =============================================================================
INSERT INTO public.hidden_achievements (
    achievement_key, title, description, secret_hint, trigger_type, trigger_config,
    xp_reward, coin_reward, exclusive_badge, rarity
) VALUES
    ('secret_midnight_call', 'Night Owls', 'Have the entire family join a call at 3AM', 'Something happens at 3AM...',
     'time_based', '{"hour": 3, "all_members": true, "min_count": 3}',
     1000, 5000, 'night_owl', 'legendary'),
    
    ('secret_hour_storm', 'Message Storm', 'Send 100 messages in 1 hour', 'Speed matters...',
     'event_count', '{"event": "message", "count": 100, "timeframe": "hour"}',
     1500, 7500, 'speed_demon', 'legendary'),
    
    ('secret_last_second', 'Last Second Victory', 'Win a battle with under 5 seconds remaining', 'Time is everything...',
     'event_count', '{"event": "battle_win", "time_remaining": 5}',
     2000, 10000, 'clutch_player', 'mythic'),
    
    ('secret_returner', 'Welcome Back', 'A member returns after 30+ days of inactivity', 'Old friends return...',
     'streak', '{"type": "return", "days_inactive": 30}',
     500, 2500, 'faithful', 'rare'),
    
    ('secret_perfect_week', 'Perfect Week', 'Complete all weekly goals 4 weeks in a row', 'Consistency is key...',
     'streak', '{"type": "weekly_goals", "weeks": 4}',
     3000, 15000, 'perfectionist', 'mythic'),
    
    ('secret_invite_chain', 'Chain Reaction', 'Invite 10 members who each invite someone', 'Grow the family tree...',
     'event_count', '{"event": "invite", "chain_length": 10}',
     2500, 12500, 'recruiter_king', 'epic'),
    
    ('secret_battle_streak', 'Undefeated', 'Win 10 battles in a row', 'Unstoppable force...',
     'streak', '{"type": "battle_wins", "count": 10}',
     4000, 20000, 'undefeated', 'mythic'),
    
    ('secret_generous', 'Patron', 'Send gifts worth 100,000 coins in total', 'Generosity knows no bounds...',
     'event_count', '{"event": "gifts_sent", "total_value": 100000}',
     2000, 10000, 'patron', 'epic'),
    
    ('secret_early_bird', 'Early Bird', 'Start the first call of the day (before 6AM)', 'The early bird...',
     'time_based', '{"hour": 6, "first_call": true}',
     750, 3750, 'early_bird', 'rare'),
    
    ('secret_socialite', 'Social Butterfly', 'Have 50 different users in your family calls', 'Popular family!',
     'event_count', '{"event": "unique_callers", "count": 50}',
     1500, 7500, 'socialite', 'epic')
ON CONFLICT (achievement_key) DO NOTHING;

-- =============================================================================
-- SEED FAMILY LEVEL UNLOCKS
-- =============================================================================
INSERT INTO public.family_level_unlocks (
    level, unlock_type, unlock_key, unlock_name, unlock_description, icon, color
) VALUES
    (2, 'theme', 'dark_blue', 'Dark Blue Theme', 'A calming blue theme for your family', '🔵', '#2196F3'),
    (3, 'badge', 'bronze_founder', 'Bronze Founder Badge', 'Show your founding status', '🥉', '#CD7F32'),
    (4, 'effect', 'glow_effect', 'Family Glow Effect', 'Add a subtle glow to your family', '✨', '#FF9800'),
    (5, 'theme', 'royal_purple', 'Royal Purple Theme', 'A majestic purple theme', '🟣', '#9C27B0'),
    (6, 'badge', 'silver_founder', 'Silver Founder Badge', 'Enhanced founder badge', '🥈', '#C0C0C0'),
    (7, 'feature', 'custom_emoji', 'Custom Family Emoji', 'Create your own family emoji', '😀', '#E91E63'),
    (8, 'effect', 'pulse_effect', 'Pulse Effect', 'Animated pulse effect', '💫', '#00BCD4'),
    (9, 'theme', 'emerald_green', 'Emerald Theme', 'A wealthy green theme', '💚', '#4CAF50'),
    (10, 'badge', 'gold_founder', 'Gold Founder Badge', 'Premium founder badge', '🥇', '#FFD700'),
    (11, 'feature', 'priority_matchmaking', 'Priority Matchmaking', 'Get优先匹配 in battles', '⚡', '#FF5722'),
    (12, 'effect', 'fire_effect', 'Fire Effect', 'Fiery animated effect', '🔥', '#F44336'),
    (13, 'theme', 'diamond_theme', 'Diamond Theme', 'A sparkling diamond theme', '💎', '#B9F2FF'),
    (14, 'badge', 'platinum_founder', 'Platinum Founder Badge', 'Ultimate founder badge', '💎', '#E5E4E2'),
    (15, 'feature', 'exclusive_rooms', 'Exclusive Family Rooms', 'Create private themed rooms', '🏠', '#673AB7'),
    (16, 'effect', 'legendary_aura', 'Legendary Aura', 'The ultimate family aura', '⚔️', '#FFD700')
ON CONFLICT (level) DO NOTHING;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function: Calculate XP required for a given level
CREATE OR REPLACE FUNCTION public.get_xp_for_level(p_level INTEGER)
RETURNS BIGINT AS $$
BEGIN
    -- XP formula: 1000 * (level ^ 1.5)
    RETURN (1000 * (POWER(p_level, 1.5)))::BIGINT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Calculate tier from family stats
CREATE OR REPLACE FUNCTION public.calculate_family_tier(
    p_messages BIGINT,
    p_calls BIGINT,
    p_coins BIGINT,
    p_battles BIGINT,
    p_members INTEGER,
    p_streak INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    v_tier INTEGER := 1;
    v_score BIGINT := 0;
BEGIN
    -- Calculate score based on achievements
    -- Higher tiers require more of everything
    v_score := 
        (p_messages / 50) + 
        (p_calls * 5) + 
        (p_coins / 1000) + 
        (p_battles * 10) + 
        (p_members * 2) + 
        (p_streak * 5);
    
    -- Determine tier based on score
    IF v_score >= 10000 THEN v_tier := 16;
    ELSIF v_score >= 5000 THEN v_tier := 15;
    ELSIF v_score >= 2500 THEN v_tier := 14;
    ELSIF v_score >= 1500 THEN v_tier := 13;
    ELSIF v_score >= 1000 THEN v_tier := 12;
    ELSIF v_score >= 700 THEN v_tier := 11;
    ELSIF v_score >= 500 THEN v_tier := 10;
    ELSIF v_score >= 350 THEN v_tier := 9;
    ELSIF v_score >= 250 THEN v_tier := 8;
    ELSIF v_score >= 175 THEN v_tier := 7;
    ELSIF v_score >= 125 THEN v_tier := 6;
    ELSIF v_score >= 85 THEN v_tier := 5;
    ELSIF v_score >= 55 THEN v_tier := 4;
    ELSIF v_score >= 30 THEN v_tier := 3;
    ELSIF v_score >= 15 THEN v_tier := 2;
    ELSE v_tier := 1;
    END IF;
    
    RETURN v_tier;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Check and update family level
CREATE OR REPLACE FUNCTION public.check_and_update_family_level(p_family_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_stats RECORD;
    v_current_level INTEGER;
    v_new_level INTEGER;
    v_xp_needed BIGINT;
    v_new_tier INTEGER;
    v_result JSONB;
BEGIN
    -- Get current stats
    SELECT * INTO v_stats FROM public.family_stats_enhanced WHERE family_id = p_family_id;
    
    IF v_stats IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Family stats not found');
    END IF;
    
    v_current_level := v_stats.level;
    
    -- Calculate new level based on XP
    v_new_level := v_current_level;
    LOOP
        v_xp_needed := public.get_xp_for_level(v_new_level + 1);
        EXIT WHEN v_stats.xp < v_xp_needed OR v_new_level >= 100;
        v_new_level := v_new_level + 1;
    END LOOP;
    
    -- Calculate new tier
    v_new_tier := public.calculate_family_tier(
        v_stats.total_messages,
        v_stats.total_calls,
        v_stats.total_coins,
        v_stats.total_battle_wins,
        (SELECT COUNT(*) FROM public.family_members WHERE family_id = p_family_id),
        v_stats.current_streak
    );
    
    -- Update if level or tier changed
    IF v_new_level > v_current_level OR v_new_tier > v_stats.current_tier THEN
        UPDATE public.family_stats_enhanced
        SET 
            level = v_new_level,
            xp_to_next_level = public.get_xp_for_level(v_new_level + 1),
            current_tier = v_new_tier,
            tier_completed_at = CASE WHEN v_new_tier > v_stats.current_tier THEN NOW() ELSE tier_completed_at END,
            updated_at = NOW()
        WHERE family_id = p_family_id;
        
        v_result := jsonb_build_object(
            'success', true,
            'level_up', v_new_level > v_current_level,
            'new_level', v_new_level,
            'tier_up', v_new_tier > v_stats.current_tier,
            'new_tier', v_new_tier
        );
    ELSE
        v_result := jsonb_build_object('success', true, 'level_up', false, 'tier_up', false);
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Award XP and coins to family
CREATE OR REPLACE FUNCTION public.award_family_xp(
    p_family_id UUID,
    p_xp_amount INTEGER,
    p_coin_amount BIGINT DEFAULT 0,
    p_source TEXT DEFAULT 'achievement'
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Update family stats
    UPDATE public.family_stats_enhanced
    SET 
        xp = xp + p_xp_amount,
        total_coins = total_coins + p_coin_amount,
        updated_at = NOW()
    WHERE family_id = p_family_id;
    
    -- Check for level/tier up
    v_result := public.check_and_update_family_level(p_family_id);
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function: Generate weekly goals for a family
CREATE OR REPLACE FUNCTION public.generate_weekly_goals(p_family_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_week_number INTEGER;
    v_year INTEGER;
    v_stats RECORD;
    v_goals_generated INTEGER := 0;
    v_goal_keys TEXT[] := ARRAY['messages', 'calls', 'coins', 'gifts', 'battles', 'invites'];
    v_selected_key TEXT;
    v_target BIGINT;
    v_difficulty TEXT;
BEGIN
    -- Get current week
    v_week_number := EXTRACT(WEEK FROM NOW())::INTEGER;
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
    
    -- Get family stats for scaling
    SELECT * INTO v_stats FROM public.family_stats_enhanced WHERE family_id = p_family_id;
    
    -- Delete existing goals for this week
    DELETE FROM public.weekly_family_goals_new 
    WHERE family_id = p_family_id AND week_number = v_week_number AND year = v_year;
    
    -- Generate 3 random goals
    FOR i IN 1..3 LOOP
        -- Pick random goal type
        v_selected_key := v_goal_keys[1 + floor(random() * array_length(v_goal_keys, 1))];
        
        -- Scale target based on family level and previous performance
        CASE v_selected_key
            WHEN 'messages' THEN
                v_target := COALESCE(v_stats.total_messages / 10, 50) * (1 + v_stats.level * 0.1);
                v_difficulty := CASE WHEN v_target > 500 THEN 'hard' WHEN v_target > 200 THEN 'medium' ELSE 'easy' END;
            WHEN 'calls' THEN
                v_target := COALESCE(v_stats.total_calls / 8, 2) * (1 + v_stats.level * 0.1);
                v_difficulty := CASE WHEN v_target > 10 THEN 'hard' WHEN v_target > 5 THEN 'medium' ELSE 'easy' END;
            WHEN 'coins' THEN
                v_target := COALESCE(v_stats.total_coins / 8, 1000) * (1 + v_stats.level * 0.1);
                v_difficulty := CASE WHEN v_target > 50000 THEN 'hard' WHEN v_target > 20000 THEN 'medium' ELSE 'easy' END;
            WHEN 'gifts' THEN
                v_target := COALESCE(v_stats.total_gifts / 8, 5) * (1 + v_stats.level * 0.1);
                v_difficulty := CASE WHEN v_target > 20 THEN 'hard' WHEN v_target > 10 THEN 'medium' ELSE 'easy' END;
            WHEN 'battles' THEN
                v_target := COALESCE(v_stats.total_battles / 8, 3) * (1 + v_stats.level * 0.1);
                v_difficulty := CASE WHEN v_target > 15 THEN 'hard' WHEN v_target > 8 THEN 'medium' ELSE 'easy' END;
            WHEN 'invites' THEN
                v_target := 1 + floor(v_stats.level / 5);
                v_difficulty := 'medium';
            ELSE
                v_target := 100;
                v_difficulty := 'easy';
        END CASE;
        
        -- Insert goal
        INSERT INTO public.weekly_family_goals_new (
            family_id, goal_key, title, description, category, difficulty,
            target, xp_reward, coin_reward, week_number, year, expires_at
        ) VALUES (
            p_family_id,
            v_selected_key,
            CASE v_selected_key
                WHEN 'messages' THEN 'Message Masters'
                WHEN 'calls' THEN 'Stay Connected'
                WHEN 'coins' THEN 'Coin Collectors'
                WHEN 'gifts' THEN 'Gift Givers'
                WHEN 'battles' THEN 'Battle Champions'
                WHEN 'invites' THEN 'Recruiters'
            END,
            CASE v_selected_key
                WHEN 'messages' THEN 'Send ' || v_target::INTEGER || ' messages this week'
                WHEN 'calls' THEN 'Make ' || v_target::INTEGER || ' calls this week'
                WHEN 'coins' THEN 'Earn ' || v_target::INTEGER || ' coins this week'
                WHEN 'gifts' THEN 'Send ' || v_target::INTEGER || ' gifts this week'
                WHEN 'battles' THEN 'Win ' || v_target::INTEGER || ' battles this week'
                WHEN 'invites' THEN 'Invite ' || v_target::INTEGER || ' new members'
            END,
            v_selected_key, v_difficulty,
            v_target::BIGINT,
            CASE v_difficulty WHEN 'hard' THEN 400 WHEN 'medium' THEN 250 ELSE 150 END,
            CASE v_difficulty WHEN 'hard' THEN 2000 WHEN 'medium' THEN 1000 ELSE 500 END,
            v_week_number, v_year,
            NOW() + INTERVAL '7 days'
        );
        
        v_goals_generated := v_goals_generated + 1;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'goals_generated', v_goals_generated,
        'week', v_week_number,
        'year', v_year
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Check rate limit for user
CREATE OR REPLACE FUNCTION public.check_family_rate_limit(
    p_family_id UUID,
    p_user_id UUID,
    p_event_type TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_limit RECORD;
    v_count INTEGER;
    v_window_start TIMESTAMPTZ;
BEGIN
    -- Get or create rate limit record
    SELECT * INTO v_limit FROM public.family_rate_limits
    WHERE family_id = p_family_id AND user_id = p_user_id AND event_type = p_event_type;
    
    IF v_limit IS NULL THEN
        INSERT INTO public.family_rate_limits (family_id, user_id, event_type, count, window_start)
        VALUES (p_family_id, p_user_id, p_event_type, 1, NOW())
        RETURNING count INTO v_count;
        
        RETURN jsonb_build_object('allowed', true, 'count', v_count);
    END IF;
    
    -- Check if window has expired (1 hour)
    IF v_limit.window_start < NOW() - INTERVAL '1 hour' THEN
        UPDATE public.family_rate_limits
        SET count = 1, window_start = NOW()
        WHERE family_id = p_family_id AND user_id = p_user_id AND event_type = p_event_type;
        
        RETURN jsonb_build_object('allowed', true, 'count', 1);
    END IF;
    
    -- Check limits
    IF v_limit.count >= COALESCE(v_limit.max_per_hour, 100) THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'error', 'rate_limit_exceeded',
            'retry_after', (v_limit.window_start + INTERVAL '1 hour' - NOW())::INTEGER
        );
    END IF;
    
    -- Increment count
    UPDATE public.family_rate_limits
    SET count = count + 1
    WHERE family_id = p_family_id AND user_id = p_user_id AND event_type = p_event_type;
    
    RETURN jsonb_build_object('allowed', true, 'count', v_limit.count + 1);
END;
$$ LANGUAGE plpgsql;

-- Function: Get family leaderboard
CREATE OR REPLACE FUNCTION public.get_family_leaderboard(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    rank INTEGER,
    family_id UUID,
    family_name TEXT,
    level INTEGER,
    xp BIGINT,
    tier INTEGER,
    member_count BIGINT,
    streak INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY fse.xp DESC) AS rank,
        f.id,
        f.name,
        fse.level,
        fse.xp,
        fse.current_tier,
        (SELECT COUNT(*) FROM public.family_members WHERE family_id = f.id)::BIGINT AS member_count,
        fse.current_streak
    FROM public.troll_families f
    JOIN public.family_stats_enhanced fse ON f.id = fse.family_id
    ORDER BY fse.xp DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================
GRANT SELECT ON public.family_stats_enhanced TO authenticated;
GRANT SELECT ON public.achievement_tiers TO authenticated;
GRANT SELECT ON public.achievement_definitions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.family_achievements_new TO authenticated;
GRANT SELECT ON public.weekly_family_goals_new TO authenticated;
GRANT SELECT ON public.hidden_achievements TO authenticated;
GRANT SELECT ON public.family_level_unlocks TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_xp_for_level(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_family_tier(BIGINT, BIGINT, BIGINT, BIGINT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_update_family_level(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_family_xp(UUID, INTEGER, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_weekly_goals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_family_rate_limit(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_family_leaderboard(INTEGER) TO authenticated;

SELECT 'Troll Families Achievement & Progression System created successfully!' AS result;
