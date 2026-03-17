-- =============================================================================
-- TROLL FAMILIES SYSTEM - Database Schema Migration
-- =============================================================================
-- This migration creates the complete Troll Families system replacing Family Lounge
-- Key Features:
-- - Family Goals (Daily/Weekly/Monthly) with automatic generation
-- - Family Achievements with rarity tiers
-- - Family Vault with shared progression
-- - Family Heartbeat/Pulse for member monitoring
-- - Leadership Alerts for intervention
-- - Family Rewards with 500 coins/week cap
-- - Support/Recovery mechanics
-- - Broadcasting/Pod integration for family songs
-- =============================================================================

BEGIN;

-- =============================================================================
-- TABLE: family_goals
-- Replaces old family_tasks with structured daily/weekly/monthly goals
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    
    -- Goal Identity
    title text NOT NULL,
    description text,
    category text NOT NULL CHECK (category IN ('daily', 'weekly', 'monthly')),
    difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'elite')),
    
    -- Goal Details
    target_value integer NOT NULL DEFAULT 1,
    current_value integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'failed')),
    
    -- Rewards ( Troll Coins - capped at 500/family/week at application level)
    reward_coins integer NOT NULL DEFAULT 0,
    bonus_coins integer NOT NULL DEFAULT 0, -- Early completion bonus
    reward_xp integer NOT NULL DEFAULT 0,
    
    -- Goal Type for categorization
    goal_type text NOT NULL DEFAULT 'general',
    -- e.g., 'activity', 'recruitment', 'support', 'broadcast', 'competition', 'streak'
    
    -- Timestamps
    generated_at timestamp with time zone DEFAULT NOW(),
    expires_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    
    -- Metadata
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    
    -- Constraint: prevent duplicate active goals of same type
    UNIQUE(family_id, category, goal_type, status) 
);

-- Indexes for family_goals
CREATE INDEX idx_family_goals_family_id ON public.family_goals(family_id);
CREATE INDEX idx_family_goals_category ON public.family_goals(category);
CREATE INDEX idx_family_goals_status ON public.family_goals(status);
CREATE INDEX idx_family_goals_expires_at ON public.family_goals(expires_at);

-- =============================================================================
-- TABLE: family_goal_progress
-- Tracks individual member contributions to family goals
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_goal_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id uuid NOT NULL REFERENCES public.family_goals(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    family_id uuid NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    
    -- Progress tracking
    contribution_value integer NOT NULL DEFAULT 0,
    last_activity_at timestamp with time zone DEFAULT NOW(),
    
    -- Support action tracking (for helping other members)
    supported_member_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    is_support_action boolean DEFAULT false,
    
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    
    UNIQUE(goal_id, user_id)
);

CREATE INDEX idx_family_goal_progress_goal_id ON public.family_goal_progress(goal_id);
CREATE INDEX idx_family_goal_progress_user_id ON public.family_goal_progress(user_id);
CREATE INDEX idx_family_goal_progress_family_id ON public.family_goal_progress(family_id);

-- =============================================================================
-- TABLE: family_achievements
-- Unlocks when families hit milestones
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_achievements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    
    -- Achievement Identity
    achievement_key text NOT NULL, -- unique identifier for the achievement type
    title text NOT NULL,
    description text,
    icon text, -- emoji or icon name
    
    -- Rarity
    rarity text NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    
    -- Rewards
    reward_coins integer NOT NULL DEFAULT 0,
    reward_xp integer NOT NULL DEFAULT 0,
    achievement_points integer NOT NULL DEFAULT 0,
    
    -- Status
    unlocked_at timestamp with time zone,
    is_visible boolean DEFAULT true,
    
    created_at timestamp with time zone DEFAULT NOW(),
    
    UNIQUE(family_id, achievement_key)
);

CREATE INDEX idx_family_achievements_family_id ON public.family_achievements(family_id);
CREATE INDEX idx_family_achievements_unlocked ON public.family_achievements(unlocked_at) WHERE unlocked_at IS NOT NULL;

-- =============================================================================
-- TABLE: family_reward_ledger
-- Tracks all Troll Coin rewards to enforce weekly cap
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_reward_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    
    -- Reward Details
    source_type text NOT NULL, -- 'goal', 'achievement', 'streak', 'bonus', 'support', 'competition'
    source_id uuid, -- goal_id or achievement_id
    
    coinsAwarded integer NOT NULL,
    xp_awarded integer DEFAULT 0,
    
    -- Week tracking for cap enforcement
    week_start date NOT NULL,
    week_end date NOT NULL,
    
    -- Metadata
    description text,
    awarded_at timestamp with time zone DEFAULT NOW(),
    
    CHECK (coinsAwarded >= 0)
);

CREATE INDEX idx_family_reward_ledger_family_id ON public.family_reward_ledger(family_id);
CREATE INDEX idx_family_reward_ledger_week ON public.family_reward_ledger(week_start, week_end);
CREATE INDEX idx_family_reward_ledger_family_week ON public.family_reward_ledger(family_id, week_start);

-- =============================================================================
-- TABLE: family_streaks
-- Tracks daily/weekly streaks for families
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_streaks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL UNIQUE REFERENCES public.troll_families(id) ON DELETE CASCADE,
    
    -- Streak tracking
    current_daily_streak integer NOT NULL DEFAULT 0,
    longest_daily_streak integer NOT NULL DEFAULT 0,
    last_activity_date date,
    
    current_weekly_streak integer NOT NULL DEFAULT 0,
    longest_weekly_streak integer NOT NULL DEFAULT 0,
    last_weekly_completion date,
    
    -- Streak bonus tracker
    streak_bonus_earned integer NOT NULL DEFAULT 0,
    
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW()
);

CREATE INDEX idx_family_streaks_family_id ON public.family_streaks(family_id);

-- =============================================================================
-- TABLE: family_notifications
-- Leadership alerts and family heartbeat notifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    
    -- Notification Type
    notification_type text NOT NULL,
    -- 'member_slipping', 'inactivity_warning', 'goal_alert', 'support_needed',
    -- 'streak_at_risk', 'reward_pending', 'achievement_unlocked', 'member_recovered'
    
    -- Content
    title text NOT NULL,
    message text NOT NULL,
    severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'urgent', 'success')),
    
    -- Related entities
    related_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    related_goal_id uuid REFERENCES public.family_goals(id) ON DELETE SET NULL,
    
    -- Status
    is_read boolean DEFAULT false,
    is_dismissed boolean DEFAULT false,
    
    -- Action items
    action_required boolean DEFAULT false,
    action_type text, -- 'send_encouragement', 'assign_mentor', 'nudge_member', 'review_goals'
    action_target_id uuid,
    
    created_at timestamp with time zone DEFAULT NOW(),
    read_at timestamp with time zone
);

CREATE INDEX idx_family_notifications_family_id ON public.family_notifications(family_id);
CREATE INDEX idx_family_notifications_unread ON public.family_notifications(family_id, is_read) WHERE is_read = false;
CREATE INDEX idx_family_notifications_type ON public.family_notifications(notification_type);

-- =============================================================================
-- TABLE: family_participation_tracking
-- Tracks member activity for heartbeat system
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_participation_tracking (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Daily tracking
    activity_date date NOT NULL DEFAULT CURRENT_DATE,
    
    -- Activity metrics
    messages_sent integer DEFAULT 0,
    goals_completed integer DEFAULT 0,
    points_earned integer DEFAULT 0,
    support_actions integer DEFAULT 0,
    
    -- Status flags
    is_active boolean DEFAULT true,
    is_at_risk boolean DEFAULT false,
    risk_reason text,
    
    -- Daily goal progress (percentage)
    daily_goal_progress integer DEFAULT 0,
    weekly_goal_progress integer DEFAULT 0,
    
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    
    UNIQUE(family_id, user_id, activity_date)
);

CREATE INDEX idx_family_participation_family_date ON public.family_participation_tracking(family_id, activity_date);
CREATE INDEX idx_family_participation_user_date ON public.family_participation_tracking(user_id, activity_date);
CREATE INDEX idx_family_participation_at_risk ON public.family_participation_tracking(family_id, is_at_risk) WHERE is_at_risk = true;

-- =============================================================================
-- TABLE: family_goal_templates
-- Templates for auto-generating goals
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_goal_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Template identity
    template_key text NOT NULL UNIQUE,
    title text NOT NULL,
    description text,
    category text NOT NULL CHECK (category IN ('daily', 'weekly', 'monthly')),
    goal_type text NOT NULL,
    
    -- Difficulty and scaling
    difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'elite')),
    
    -- Base targets (will be scaled by family size/level)
    base_target integer NOT NULL DEFAULT 1,
    target_multiplier float DEFAULT 1.0, -- multiplied by family size
    
    -- Rewards (base values before scaling)
    base_reward_coins integer NOT NULL DEFAULT 0,
    base_bonus_coins integer NOT NULL DEFAULT 0,
    base_reward_xp integer NOT NULL DEFAULT 0,
    
    -- Eligibility
    min_family_size integer DEFAULT 1,
    max_family_size integer DEFAULT 1000,
    min_family_level integer DEFAULT 1,
    
    -- Requirements
    required_activity_level text, -- 'new', 'active', 'inactive', 'elite'
    
    -- Weight for random selection (higher = more likely)
    selection_weight integer DEFAULT 1,
    
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT NOW()
);

-- =============================================================================
-- TABLE: family_goal_generation_runs
-- Logs when goals are generated
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_goal_generation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    
    -- Generation details
    generation_type text NOT NULL CHECK (generation_type IN ('daily', 'weekly', 'monthly', 'manual')),
    goals_generated integer NOT NULL DEFAULT 0,
    
    -- Timestamps
    generated_at timestamp with time zone DEFAULT NOW(),
    
    UNIQUE(family_id, generation_type, generated_at)
);

CREATE INDEX idx_family_goal_generation_runs_family_id ON public.family_goal_generation_runs(family_id);
CREATE INDEX idx_family_goal_generation_runs_type ON public.family_goal_generation_runs(generation_type);

-- =============================================================================
-- TABLE: family_vault
-- Shared family vault/progression system
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_vault (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL UNIQUE REFERENCES public.troll_families(id) ON DELETE CASCADE,
    
    -- Vault balances
    total_coins integer NOT NULL DEFAULT 0,
    total_xp integer NOT NULL DEFAULT 0,
    
    -- Weekly accumulation
    weekly_contribution integer NOT NULL DEFAULT 0,
    last_week_reset date,
    
    -- Bonus tracking
    streak_bonus integer NOT NULL DEFAULT 0,
    competition_bonus integer NOT NULL DEFAULT 0,
    support_bonus integer NOT NULL DEFAULT 0,
    
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW()
);

CREATE INDEX idx_family_vault_family_id ON public.family_vault(family_id);

-- =============================================================================
-- TABLE: family_members_extended
-- Extended member info for Troll Families
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_members_extended (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Family roles
    family_role text DEFAULT 'member' CHECK (family_role IN (
        'leader', 'co_leader', 'scout', 'recruiter', 'mentor', 'member', 'rising_star'
    )),
    
    -- Recruitment stage (for new members)
    recruitment_stage text DEFAULT 'member' CHECK (recruitment_stage IN (
        'prospect', 'new_blood', 'verified_member', 'active_contributor', 'rising_star'
    )),
    
    -- Mentor assignment
    mentor_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    
    -- Member stats
    contribution_points integer DEFAULT 0,
    support_points integer DEFAULT 0,
    streak_days integer DEFAULT 0,
    
    -- Status
    is_active boolean DEFAULT true,
    last_active_at timestamp with time zone,
    
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    
    UNIQUE(family_id, user_id)
);

CREATE INDEX idx_family_members_extended_family_id ON public.family_members_extended(family_id);
CREATE INDEX idx_family_members_extended_user_id ON public.family_members_extended(user_id);
CREATE INDEX idx_family_members_extended_mentor ON public.family_members_extended(mentor_id);

-- =============================================================================
-- TABLE: family_songs
-- Family songs for broadcasting/pods integration
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_songs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    
    -- Song details
    title text NOT NULL,
    description text,
    audio_url text,
    
    -- Creator
    created_by uuid NOT NULL REFERENCES public.user_profiles(id),
    
    -- Stats
    plays integer DEFAULT 0,
    likes integer DEFAULT 0,
    
    -- Status
    is_featured boolean DEFAULT false,
    is_active boolean DEFAULT true,
    
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW()
);

CREATE INDEX idx_family_songs_family_id ON public.family_songs(family_id);
CREATE INDEX idx_family_songs_featured ON public.family_songs(family_id, is_featured) WHERE is_featured = true;

-- =============================================================================
-- ADD COLUMNS TO EXISTING TABLES
-- =============================================================================

-- Add creation_cost column to troll_families if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_families' AND column_name = 'creation_cost') THEN
        ALTER TABLE public.troll_families ADD COLUMN creation_cost integer DEFAULT 1000;
    END IF;
    
    -- Add legacy_score column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_families' AND column_name = 'legacy_score') THEN
        ALTER TABLE public.troll_families ADD COLUMN legacy_score integer DEFAULT 0;
    END IF;
    
    -- Add family_rank column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_families' AND column_name = 'family_rank') THEN
        ALTER TABLE public.troll_families ADD COLUMN family_rank integer DEFAULT 0;
    END IF;
    
    -- Add reputation column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_families' AND column_name = 'reputation') THEN
        ALTER TABLE public.troll_families ADD COLUMN reputation integer DEFAULT 0;
    END IF;
    
    -- Add slogan column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_families' AND column_name = 'slogan') THEN
        ALTER TABLE public.troll_families ADD COLUMN slogan text;
    END IF;
    
    -- Add crest_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_families' AND column_name = 'crest_url') THEN
        ALTER TABLE public.troll_families ADD COLUMN crest_url text;
    END IF;
    
    -- Add banner_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_families' AND column_name = 'banner_url') THEN
        ALTER TABLE public.troll_families ADD COLUMN banner_url text;
    END IF;
END $$;

-- =============================================================================
-- TABLE: family_activity_log
-- Tracks family activity events for feed/notifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.family_activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Event details
    event_type text NOT NULL,
    -- 'member_activity', 'goal_completed', 'achievement_unlocked', 'member_joined', 'member_left', 'streak_milestone'
    event_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamp with time zone DEFAULT NOW()
);

CREATE INDEX idx_family_activity_log_family_id ON public.family_activity_log(family_id);
CREATE INDEX idx_family_activity_log_created ON public.family_activity_log(created_at);

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.family_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_goal_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_reward_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_participation_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_goal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_goal_generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members_extended ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_activity_log ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Family goals: members can view, leaders can manage
CREATE POLICY "Family members can view goals" ON public.family_goals
    FOR SELECT USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "Family leaders can manage goals" ON public.family_goals
    FOR ALL USING (family_id IN (
        SELECT fm.family_id FROM public.family_members fm 
        WHERE fm.user_id = auth.uid() AND fm.role IN ('leader', 'royal_troll')
    ));

-- Family goal progress: members can view and update their own
CREATE POLICY "Members can view goal progress" ON public.family_goal_progress
    FOR SELECT USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can update own progress" ON public.family_goal_progress
    FOR ALL USING (user_id = auth.uid());

-- Family achievements: members can view
CREATE POLICY "Members can view achievements" ON public.family_achievements
    FOR SELECT USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Family rewards ledger: members can view, system can insert
CREATE POLICY "Members can view rewards" ON public.family_reward_ledger
    FOR SELECT USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Family streaks: members can view
CREATE POLICY "Members can view streaks" ON public.family_streaks
    FOR SELECT USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Family notifications: family members can view and update
CREATE POLICY "Members can view notifications" ON public.family_notifications
    FOR SELECT USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "Leaders can manage notifications" ON public.family_notifications
    FOR ALL USING (family_id IN (
        SELECT fm.family_id FROM public.family_members fm 
        WHERE fm.user_id = auth.uid() AND fm.role IN ('leader', 'co_leader', 'royal_troll')
    ));

-- Family participation: members can view their own, leaders can view all
CREATE POLICY "Members can view own participation" ON public.family_participation_tracking
    FOR SELECT USING (user_id = auth.uid() OR family_id IN (
        SELECT fm.family_id FROM public.family_members fm 
        WHERE fm.user_id = auth.uid() AND fm.role IN ('leader', 'co_leader', 'mentor', 'royal_troll')
    ));

CREATE POLICY "Members can update own participation" ON public.family_participation_tracking
    FOR ALL USING (user_id = auth.uid());

-- Family vault: members can view
CREATE POLICY "Members can view vault" ON public.family_vault
    FOR SELECT USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Family members extended: family members can view
CREATE POLICY "Members can view extended info" ON public.family_members_extended
    FOR SELECT USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can update own extended info" ON public.family_members_extended
    FOR ALL USING (user_id = auth.uid());

-- Family songs: family members can view, creators can manage
CREATE POLICY "Members can view songs" ON public.family_songs
    FOR SELECT USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can manage songs" ON public.family_songs
    FOR ALL USING (created_by = auth.uid() OR family_id IN (
        SELECT fm.family_id FROM public.family_members fm 
        WHERE fm.user_id = auth.uid() AND fm.role IN ('leader', 'co_leader', 'royal_troll')
    ));

-- Goal templates: public read
CREATE POLICY "Templates are publicly readable" ON public.family_goal_templates
    FOR SELECT USING (true);

-- Family activity log: family members can view
CREATE POLICY "Members can view activity log" ON public.family_activity_log
    FOR SELECT USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "System can insert activity log" ON public.family_activity_log
    FOR INSERT WITH CHECK (true);

-- =============================================================================
-- INSERT DEFAULT GOAL TEMPLATES
-- =============================================================================
INSERT INTO public.family_goal_templates (template_key, title, description, category, goal_type, difficulty, base_target, base_reward_coins, base_bonus_coins, base_reward_xp, selection_weight)
VALUES 
    -- DAILY GOALS - Activity
    ('daily_messages', 'Stay Connected', 'Send messages in family chat', 'daily', 'activity', 'easy', 20, 50, 25, 10, 3),
    ('daily_points', 'Earn Points', 'Earn 500 total family points today', 'daily', 'activity', 'medium', 500, 100, 50, 20, 3),
    ('daily_participation', 'Show Up', 'Have 3 members complete their daily goals', 'daily', 'activity', 'medium', 3, 75, 35, 15, 2),
    ('daily_invite', 'Spread the Word', 'Invite 1 family member to participate', 'daily', 'recruitment', 'easy', 1, 50, 25, 10, 2),
    ('daily_support', 'Lend a Hand', 'Help 1 behind member recover momentum', 'daily', 'support', 'medium', 1, 100, 50, 25, 2),
    ('daily_broadcast', 'Go Live', 'Start a broadcast for the family', 'daily', 'broadcast', 'easy', 1, 75, 35, 20, 2),
    ('daily_song', 'Family Anthem', 'Play or create a family song', 'daily', 'broadcast', 'easy', 1, 60, 30, 15, 1),
    
    -- WEEKLY GOALS - Activity
    ('weekly_points', 'Weekly Points Push', 'Reach 5,000 family points this week', 'weekly', 'activity', 'hard', 5000, 500, 250, 100, 3),
    ('weekly_full_participation', 'Full Family', 'Have 5 active family members complete all daily goals for 3 days', 'weekly', 'activity', 'hard', 3, 400, 200, 80, 2),
    ('weekly_support', 'Team Support', 'Complete 2 family support actions', 'weekly', 'support', 'medium', 2, 300, 150, 60, 2),
    ('weekly_recruit', 'Grow the Family', 'Recruit 1 eligible new member', 'weekly', 'recruitment', 'medium', 1, 350, 175, 70, 2),
    ('weekly_streak', 'Keep the Streak', 'Maintain family streak status for the full week', 'weekly', 'streak', 'medium', 7, 400, 200, 80, 3),
    ('weekly_broadcast', 'Family Stream', 'Complete 3 family broadcasts this week', 'weekly', 'broadcast', 'medium', 3, 350, 175, 70, 2),
    ('weekly_song', 'Family Melody', 'Create or play family songs 5 times', 'weekly', 'broadcast', 'easy', 5, 250, 125, 50, 1),
    
    -- WEEKLY GOALS - Competition
    ('weekly_war', 'War Champion', 'Win 1 competitive family event', 'weekly', 'competition', 'hard', 1, 600, 300, 120, 2),
    ('weekly_leaderboard', 'Climb the Ranks', 'Finish in top 10 on family leaderboard', 'weekly', 'competition', 'hard', 10, 500, 250, 100, 2),
    
    -- MONTHLY GOALS - Activity
    ('monthly_points', 'Monthly Mastery', 'Reach 25,000 family points this month', 'monthly', 'activity', 'elite', 25000, 2000, 1000, 400, 3),
    ('monthly_retention', 'Stick Together', 'Have 80% of family members remain active', 'monthly', 'activity', 'hard', 80, 1500, 750, 300, 2),
    ('monthly_goals_complete', 'Goal Getters', 'Complete every weekly goal for the month', 'monthly', 'activity', 'elite', 4, 2500, 1250, 500, 2),
    ('monthly_streak', 'Unstoppable', 'Maintain 30-day family streak', 'monthly', 'streak', 'elite', 30, 3000, 1500, 600, 2),
    ('monthly_recovery', 'Never Give Up', 'Recover 3 inactive members into active participation', 'monthly', 'support', 'hard', 3, 1200, 600, 240, 1),
    ('monthly_song', 'Family Anthem Masters', 'Create a featured family song', 'monthly', 'broadcast', 'medium', 1, 800, 400, 160, 1)
ON CONFLICT (template_key) DO NOTHING;

-- =============================================================================
-- INSERT ACHIEVEMENT DEFINITIONS (as system achievements that can unlock)
-- =============================================================================
-- Note: Achievements are created when unlocked, but we track the achievement_keys here
-- Family achievements will be created in family_achievements when unlocked

-- =============================================================================
-- CREATE RPC FUNCTIONS
-- =============================================================================

-- Function: Get family weekly reward total (for cap enforcement)
CREATE OR REPLACE FUNCTION public.get_family_weekly_reward_total(p_family_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_week_start date;
    v_week_end date;
    v_total integer;
BEGIN
    -- Get current week (Monday start)
    v_week_start := DATE_TRUNC('week', CURRENT_DATE)::date;
    v_week_end := v_week_start + 6;
    
    SELECT COALESCE(SUM(coinsAwarded), 0)
    INTO v_total
    FROM public.family_reward_ledger
    WHERE family_id = p_family_id
      AND week_start = v_week_start
      AND week_end = v_week_end;
    
    RETURN v_total;
END;
$$;

-- Function: Award coins to family with weekly cap
CREATE OR REPLACE FUNCTION public.award_family_coins(
    p_family_id uuid,
    p_source_type text,
    p_source_id uuid,
    p_coins integer,
    p_xp integer DEFAULT 0,
    p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_week_start date;
    v_week_end date;
    v_current_total integer;
    v_award_amount integer;
    v_max_weekly_cap integer := 500; -- Maximum 500 coins per family per week
    v_result jsonb;
BEGIN
    -- Get current week
    v_week_start := DATE_TRUNC('week', CURRENT_DATE)::date;
    v_week_end := v_week_start + 6;
    
    -- Get current weekly total
    v_current_total := public.get_family_weekly_reward_total(p_family_id);
    
    -- Calculate how much can be awarded (cap at 500 per week)
    v_award_amount := LEAST(p_coins, v_max_weekly_cap - v_current_total);
    
    IF v_award_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'awarded', 0,
            'reason', 'weekly_cap_reached',
            'current_total', v_current_total
        );
    END IF;
    
    -- Insert reward record
    INSERT INTO public.family_reward_ledger (
        family_id, source_type, source_id, coinsAwarded, xp_awarded,
        week_start, week_end, description
    ) VALUES (
        p_family_id, p_source_type, p_source_id, v_award_amount, p_xp,
        v_week_start, v_week_end, p_description
    );
    
    -- Update family vault
    INSERT INTO public.family_vault (family_id, total_coins, total_xp, weekly_contribution, last_week_reset)
    VALUES (p_family_id, v_award_amount, p_xp, v_award_amount, v_week_start)
    ON CONFLICT (family_id) DO UPDATE SET
        total_coins = family_vault.total_coins + v_award_amount,
        total_xp = family_vault.total_xp + p_xp,
        weekly_contribution = CASE 
            WHEN family_vault.last_week_reset = v_week_start 
            THEN family_vault.weekly_contribution + v_award_amount
            ELSE v_award_amount
        END,
        last_week_reset = CASE 
            WHEN family_vault.last_week_reset < v_week_start 
            THEN v_week_start 
            ELSE family_vault.last_week_reset 
        END,
        updated_at = NOW();
    
    v_result := jsonb_build_object(
        'success', true,
        'awarded', v_award_amount,
        'requested', p_coins,
        'current_total', v_current_total + v_award_amount,
        'capped', v_award_amount < p_coins
    );
    
    RETURN v_result;
END;
$$;

-- Function: Generate goals for a family
CREATE OR REPLACE FUNCTION public.generate_family_goals(
    p_family_id uuid,
    p_generation_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_goal_count integer := 0;
    v_template record;
    v_target_value integer;
    v_reward_coins integer;
    v_bonus_coins integer;
    v_expires_at timestamp;
    v_category text;
    v_family_size integer;
    v_result jsonb;
BEGIN
    -- Get family size
    SELECT COUNT(*) INTO v_family_size
    FROM public.family_members
    WHERE family_id = p_family_id;
    
    -- Set category and expiry based on type
    CASE p_generation_type
        WHEN 'daily' THEN
            v_category := 'daily';
            v_expires_at := NOW() + INTERVAL '1 day';
        WHEN 'weekly' THEN
            v_category := 'weekly';
            v_expires_at := NOW() + INTERVAL '7 days';
        WHEN 'monthly' THEN
            v_category := 'monthly';
            v_expires_at := NOW() + INTERVAL '30 days';
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'Invalid generation type');
    END CASE;
    
    -- Mark existing active goals as expired
    UPDATE public.family_goals
    SET status = 'expired', updated_at = NOW()
    WHERE family_id = p_family_id
      AND category = v_category
      AND status = 'active';
    
    -- Select and insert goals based on templates
    FOR v_template IN
        SELECT * FROM public.family_goal_templates
        WHERE category = v_category
          AND is_active = true
          AND (min_family_size IS NULL OR v_family_size >= min_family_size)
          AND (max_family_size IS NULL OR v_family_size <= max_family_size)
        ORDER BY selection_weight * RANDOM()
        LIMIT CASE 
            WHEN v_category = 'daily' THEN 3
            WHEN v_category = 'weekly' THEN 4
            ELSE 5
        END
    LOOP
        -- Calculate scaled values
        v_target_value := v_template.base_target;
        v_reward_coins := v_template.base_reward_coins;
        v_bonus_coins := v_template.base_bonus_coins;
        
        -- Scale by family size for activity goals
        IF v_template.goal_type = 'activity' AND v_family_size > 1 THEN
            v_target_value := v_target_value * LEAST(v_family_size / 3, 3);
            v_reward_coins := v_reward_coins * LEAST(v_family_size / 5, 2);
            v_bonus_coins := v_bonus_coins * LEAST(v_family_size / 5, 2);
        END IF;
        
        -- Insert goal
        INSERT INTO public.family_goals (
            family_id, title, description, category, difficulty,
            target_value, reward_coins, bonus_coins, reward_xp,
            goal_type, expires_at
        ) VALUES (
            p_family_id, v_template.title, v_template.description, v_category, v_template.difficulty,
            v_target_value, v_reward_coins, v_bonus_coins, v_template.base_reward_xp,
            v_template.goal_type, v_expires_at
        );
        
        v_goal_count := v_goal_count + 1;
    END LOOP;
    
    -- Log generation run
    INSERT INTO public.family_goal_generation_runs (family_id, generation_type, goals_generated)
    VALUES (p_family_id, p_generation_type, v_goal_count);
    
    RETURN jsonb_build_object(
        'success', true,
        'goals_generated', v_goal_count,
        'category', v_category
    );
END;
$$;

-- Function: Complete a family goal
CREATE OR REPLACE FUNCTION public.complete_family_goal(
    p_goal_id uuid,
    p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_goal record;
    v_award_result jsonb;
    v_is_early boolean;
BEGIN
    -- Get goal details
    SELECT * INTO v_goal
    FROM public.family_goals
    WHERE id = p_goal_id;
    
    IF v_goal IS NULL OR v_goal.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Goal not found or not active');
    END IF;
    
    -- Check if early completion (more than 50% time remaining)
    v_is_early := (v_goal.expires_at - NOW()) > (v_goal.expires_at - v_goal.generated_at) * 0.5;
    
    -- Update goal status
    UPDATE public.family_goals
    SET status = 'completed',
        current_value = target_value,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_goal_id;
    
    -- Calculate reward (base + bonus if early)
    DECLARE
        v_total_coins integer;
    BEGIN
        v_total_coins := v_goal.reward_coins;
        IF v_is_early THEN
            v_total_coins := v_total_coins + v_goal.bonus_coins;
        END IF;
        
        -- Award coins
        IF v_total_coins > 0 THEN
            v_award_result := public.award_family_coins(
                v_goal.family_id,
                'goal',
                p_goal_id,
                v_total_coins,
                v_goal.reward_xp,
                CASE 
                    WHEN v_is_early THEN v_goal.title || ' (Early Completion Bonus!)'
                    ELSE v_goal.title
                END
            );
        END IF;
    END;
    
    RETURN jsonb_build_object(
        'success', true,
        'goal_id', p_goal_id,
        'coins_awarded', v_award_result->>'awarded',
        'xp_awarded', v_goal.reward_xp,
        'early_bonus', v_is_early
    );
END;
$$;

-- Function: Get family heartbeat/summary
CREATE OR REPLACE FUNCTION public.get_family_heartbeat(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
    v_total_members integer;
    v_active_members integer;
    v_at_risk_count integer;
    v_behind_count integer;
    v_goals_active integer;
    v_goals_completed integer;
    v_streak record;
    v_recent_notifications integer;
BEGIN
    -- Get member stats using separate queries for compatibility
    SELECT COUNT(*) FILTER (WHERE fpt.is_active = true)::integer INTO v_active_members
    FROM public.family_participation_tracking fpt
    WHERE fpt.family_id = p_family_id
      AND fpt.activity_date = CURRENT_DATE;
    
    SELECT COUNT(*) FILTER (WHERE fpt.is_at_risk = true)::integer INTO v_at_risk_count
    FROM public.family_participation_tracking fpt
    WHERE fpt.family_id = p_family_id
      AND fpt.activity_date = CURRENT_DATE;
    
    SELECT COUNT(*) INTO v_total_members
    FROM public.family_members
    WHERE family_id = p_family_id;
    
    -- Get goal stats using separate queries for compatibility
    SELECT COUNT(*) FILTER (WHERE status = 'active')::integer INTO v_goals_active
    FROM public.family_goals
    WHERE family_id = p_family_id;
    
    SELECT COUNT(*) FILTER (WHERE status = 'completed')::integer INTO v_goals_completed
    FROM public.family_goals
    WHERE family_id = p_family_id;
    
    -- Get streak
    SELECT * INTO v_streak
    FROM public.family_streaks
    WHERE family_id = p_family_id;
    
    -- Get unread notifications count
    SELECT COUNT(*) INTO v_recent_notifications
    FROM public.family_notifications
    WHERE family_id = p_family_id
      AND is_read = false;
    
    -- Calculate family health
    DECLARE
        v_health text;
    BEGIN
        IF v_at_risk_count = 0 AND v_active_members >= v_total_members * 0.8 THEN
            v_health := 'thriving';
        ELSIF v_at_risk_count > v_total_members * 0.3 THEN
            v_health := 'struggling';
        ELSE
            v_health := 'stable';
        END IF;
    END;
    
    v_result := jsonb_build_object(
        'family_id', p_family_id,
        'health', v_health,
        'total_members', v_total_members,
        'active_members', v_active_members,
        'at_risk_members', v_at_risk_count,
        'goals_active', v_goals_active,
        'goals_completed', v_goals_completed,
        'current_streak', v_streak.current_daily_streak,
        'unread_notifications', v_recent_notifications,
        'timestamp', NOW()
    );
    
    RETURN v_result;
END;
$$;

-- Function: Create a family (with 1000 coin cost)
CREATE OR REPLACE FUNCTION public.create_troll_family(
    p_name text,
    p_tag text,
    p_description text DEFAULT NULL,
    p_slogan text DEFAULT NULL,
    p_crest_url text DEFAULT NULL,
    p_banner_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_user_coins integer;
    v_family_id uuid;
    v_creation_cost integer := 1000;
    v_result jsonb;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Check user's coin balance
    SELECT COALESCE(free_coins, 0) + COALESCE(paid_coins, 0) INTO v_user_coins
    FROM public.user_profiles
    WHERE id = v_user_id;
    
    IF v_user_coins < v_creation_cost THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'insufficient_coins',
            'required', v_creation_cost,
            'available', v_user_coins,
            'message', 'You need ' || v_creation_cost || ' Troll Coins to create a family'
        );
    END IF;
    
    -- Check user is not already in a family
    IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id = v_user_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'already_in_family',
            'message', 'You are already in a family'
        );
    END IF;
    
    -- Deduct coins (atomic operation)
    UPDATE public.user_profiles
    SET free_coins = free_coins - v_creation_cost
    WHERE id = v_user_id
      AND free_coins >= v_creation_cost;
    
    IF NOT FOUND THEN
        -- Try paid coins if free coins insufficient
        UPDATE public.user_profiles
        SET paid_coins = paid_coins - v_creation_cost
        WHERE id = v_user_id
          AND paid_coins >= v_creation_cost;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'insufficient_coins',
                'message', 'Failed to deduct coins'
            );
        END IF;
    END IF;
    
    -- Create the family
    INSERT INTO public.troll_families (
        name, tag, description, slogan, crest_url, banner_url,
        creation_cost, owner_id, level, xp
    ) VALUES (
        p_name, p_tag, p_description, p_slogan, p_crest_url, p_banner_url,
        v_creation_cost, v_user_id, 1, 0
    )
    RETURNING id INTO v_family_id;
    
    -- Add creator as leader
    INSERT INTO public.family_members (
        family_id, user_id, role, is_royal_troll
    ) VALUES (
        v_family_id, v_user_id, 'leader', true
    );
    
    -- Create family vault
    INSERT INTO public.family_vault (family_id)
    VALUES (v_family_id);
    
    -- Create family streaks
    INSERT INTO public.family_streaks (family_id)
    VALUES (v_family_id);
    
    -- Generate initial daily goals
    PERFORM public.generate_family_goals(v_family_id, 'daily');
    
    v_result := jsonb_build_object(
        'success', true,
        'family_id', v_family_id,
        'family_name', p_name,
        'cost_deducted', v_creation_cost,
        'message', 'Welcome to Troll Families! Your family has been created.'
    );
    
    RETURN v_result;
END;
$$;

-- Function: Update family participation (called by various activities)
CREATE OR REPLACE FUNCTION public.update_family_participation(
    p_user_id uuid,
    p_activity_type text,
    p_value integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_family_id uuid;
    v_participation_id uuid;
    v_activity_date date := CURRENT_DATE;
BEGIN
    -- Get user's family
    SELECT family_id INTO v_family_id
    FROM public.family_members
    WHERE user_id = p_user_id
    LIMIT 1;
    
    IF v_family_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Get or create today's participation record
    SELECT id INTO v_participation_id
    FROM public.family_participation_tracking
    WHERE family_id = v_family_id
      AND user_id = p_user_id
      AND activity_date = v_activity_date;
    
    IF v_participation_id IS NULL THEN
        INSERT INTO public.family_participation_tracking (
            family_id, user_id, activity_date
        ) VALUES (
            v_family_id, p_user_id, v_activity_date
        )
        RETURNING id INTO v_participation_id;
    END IF;
    
    -- Update based on activity type
    CASE p_activity_type
        WHEN 'message' THEN
            UPDATE public.family_participation_tracking
            SET messages_sent = messages_sent + p_value,
                updated_at = NOW()
            WHERE id = v_participation_id;
            
        WHEN 'goal_complete' THEN
            UPDATE public.family_participation_tracking
            SET goals_completed = goals_completed + p_value,
                updated_at = NOW()
            WHERE id = v_participation_id;
            
        WHEN 'points' THEN
            UPDATE public.family_participation_tracking
            SET points_earned = points_earned + p_value,
                updated_at = NOW()
            WHERE id = v_participation_id;
            
        WHEN 'support' THEN
            UPDATE public.family_participation_tracking
            SET support_actions = support_actions + p_value,
                updated_at = NOW()
            WHERE id = v_participation_id;
    END CASE;
    
    -- Mark as active
    UPDATE public.family_participation_tracking
    SET is_active = true,
        last_activity_at = NOW()
    WHERE id = v_participation_id;
    
    -- Update family streak
    UPDATE public.family_streaks
    SET current_daily_streak = current_daily_streak + 1,
        longest_daily_streak = GREATEST(longest_daily_streak, current_daily_streak + 1),
        last_activity_date = v_activity_date,
        updated_at = NOW()
    WHERE family_id = v_family_id
      AND last_activity_date < v_activity_date;
    
    -- Insert activity log
    INSERT INTO public.family_activity_log (family_id, user_id, event_type, event_message)
    VALUES (v_family_id, p_user_id, 'member_activity', p_activity_type);
END;
$$;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
