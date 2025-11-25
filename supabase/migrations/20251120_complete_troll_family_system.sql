-- Complete Troll Family System Migration
-- This migration creates a comprehensive family system with tasks, wars, ranks, and rewards

-- 1. Enhanced families table with XP, banner, and war stats
ALTER TABLE families ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE families ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE families ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS emoji TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS color_theme TEXT DEFAULT '#FF6B35';
ALTER TABLE families ADD COLUMN IF NOT EXISTS family_code TEXT UNIQUE;
ALTER TABLE families ADD COLUMN IF NOT EXISTS war_wins INTEGER DEFAULT 0;
ALTER TABLE families ADD COLUMN IF NOT EXISTS war_losses INTEGER DEFAULT 0;
ALTER TABLE families ADD COLUMN IF NOT EXISTS clan_vault_coins INTEGER DEFAULT 0;
ALTER TABLE families ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Generate unique family codes
UPDATE families SET family_code = 'FAM' || LPAD(CAST(id AS TEXT), 6, '0') WHERE family_code IS NULL;

-- 2. Enhanced family_members table with ranks and stats
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS rank_name TEXT DEFAULT 'Troller Hatchling';
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS xp_earned INTEGER DEFAULT 0;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS tasks_completed INTEGER DEFAULT 0;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS wars_participated INTEGER DEFAULT 0;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS wars_won INTEGER DEFAULT 0;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS recruiting_bonus INTEGER DEFAULT 0;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS joined_by TEXT; -- QR code or invite link
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS is_royal_troll BOOLEAN DEFAULT false;

-- 3. Family ranks system table
CREATE TABLE IF NOT EXISTS family_ranks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    level INTEGER NOT NULL,
    min_xp INTEGER NOT NULL,
    max_xp INTEGER,
    badge_icon TEXT,
    profile_frame_url TEXT,
    coin_multiplier NUMERIC DEFAULT 1.0,
    description TEXT,
    is_royal BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert rank progression
INSERT INTO family_ranks (name, level, min_xp, badge_icon, coin_multiplier, description) VALUES
('Troller Hatchling', 1, 0, '🥚', 1.0, 'Fresh from the troll farm'),
('Meme Gremlin', 2, 100, '🐸', 1.1, 'Master of chaos and memes'),
('Echo Raider', 3, 500, '🔊', 1.2, 'Amplifies the family voice'),
('Troll Knight', 4, 1000, '⚔️', 1.3, 'Defender of the family honor'),
('Mischief Captain', 5, 2500, '🏴‍☠️', 1.5, 'Commands respect and chaos'),
('Chaos Commander', 6, 5000, '👑', 1.8, 'Legendary troll leader'),
('Royal Troll', 7, 10000, '👑', 2.0, 'Supreme ruler of the family');

-- 4. Family tasks system
CREATE TABLE IF NOT EXISTS family_tasks_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL CHECK (task_type IN ('Display', 'Influence', 'Mischief', 'Power')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    reward_coins INTEGER DEFAULT 0,
    reward_xp INTEGER DEFAULT 0,
    completion_rules TEXT NOT NULL DEFAULT 'individual', -- individual, group, family
    max_participants INTEGER DEFAULT 1,
    deadline TIMESTAMP WITH TIME ZONE,
    required_items JSONB DEFAULT '[]', -- items needed to complete
    target_family_id UUID REFERENCES families(id), -- for war tasks
    target_streamer_id UUID, -- for raid tasks
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'expired')),
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- 5. Task templates for the creative tasks you specified
CREATE TABLE IF NOT EXISTS task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reward_coins INTEGER DEFAULT 0,
    reward_xp INTEGER DEFAULT 0,
    completion_rules TEXT DEFAULT 'individual',
    max_participants INTEGER DEFAULT 1,
    duration_hours INTEGER DEFAULT 24,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'legendary')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert your creative task templates
INSERT INTO task_templates (task_type, category, title, description, reward_coins, reward_xp, completion_rules, max_participants, duration_hours, difficulty) VALUES
-- Display Tasks
('emoji_war', 'Display', 'Emoji War Task', 'Flood one live stream with ONLY your official Troll Family emoji for five minutes. Viewers must guess which family is attacking.', 100, 50, 'group', 5, 2, 'medium'),
('theme_day', 'Display', 'Troll Family Colors Day', 'Everyone in the family must change their profile to the same color theme for 24 hours. Every time they go live, they must say: "Trolled, not controlled."', 150, 75, 'family', 50, 24, 'medium'),
('profile_sync', 'Display', 'Family Profile Sync', 'All family members update their profile picture to match the family theme within 1 hour', 75, 40, 'family', 20, 1, 'easy'),

-- Influence Tasks  
('gift_raid', 'Influence', 'Gift Bridge Attack', 'Coordinate a "gift raid" on another family''s broadcaster at an exact time (like 7:07 pm). Every gift must be the same. No explanation allowed.', 200, 100, 'group', 10, 3, 'hard'),
('comment_flood', 'Influence', 'Comment Cascade', 'Flood a target stream with 50+ family-related comments within 5 minutes', 120, 60, 'group', 8, 2, 'medium'),
('viewer_takeover', 'Influence', 'Broadcast Takeover', 'Three members from your family go live at the same hour, all using the same theme (neon, Viking, wizard, toxic sludge). Highest viewers wins.', 250, 125, 'group', 3, 4, 'hard'),

-- Mischief Tasks
('anthem_creation', 'Mischief', 'Troll Anthem Challenge', 'Members write and vote on a short anthem or troll chant (10 words or less). Winning version becomes that family''s official entrance sound.', 180, 90, 'family', 25, 24, 'medium'),
('troll_detective', 'Mischief', 'Troll Detective', 'Find a member of another family who secretly visited your broadcaster and left a comment. Screenshot the "intruder" and expose them.', 90, 45, 'individual', 1, 6, 'medium'),
('secret_signal', 'Mischief', 'Secret Signal Raid', 'Family members agree on a secret word or emoji. When a streamer says it, they must all instantly drop coins or gifts within 10 seconds.', 110, 55, 'group', 6, 2, 'medium'),
('story_relay', 'Mischief', 'Troll Story Relay', 'One member starts a wild story in Family Chat. Each member adds exactly one sentence. At 10 players, compile it as an official legend.', 140, 70, 'family', 15, 8, 'medium'),

-- Power Tasks
('clan_raid', 'Power', 'Troll Invasion Raid', 'One family is targeted while others raid. Leaderboard updates live.', 300, 150, 'group', 15, 4, 'legendary'),
('streaming_battle', 'Power', 'Gifty Clash Hour', 'Families choose a streamer to defend; others attack with gifts and comments', 400, 200, 'group', 20, 2, 'legendary'),
('coin_wager', 'Power', 'Coin Wager War', 'Wager family coins against another family in a live challenge', 500, 250, 'group', 12, 6, 'legendary'),
('anthem_night', 'Power', 'Troll Anthem Night', 'Each family performs anthem or chant live; users vote for winner', 350, 175, 'family', 30, 3, 'legendary');

-- 6. Task completion tracking
CREATE TABLE IF NOT EXISTS task_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES family_tasks_new(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    completion_proof TEXT, -- screenshot, video link, etc.
    completion_data JSONB DEFAULT '{}', -- metadata about completion
    verified_by UUID REFERENCES user_profiles(id), -- Royal Troll or admin
    verified_at TIMESTAMP WITH TIME ZONE,
    reward_claimed BOOLEAN DEFAULT false,
    reward_claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Family wars system
CREATE TABLE IF NOT EXISTS family_wars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    war_type TEXT NOT NULL CHECK (war_type IN ('Emoji War Royale', 'Gifty Clash Hour', 'Troll Invasion Raid', 'Anthem Night')),
    attacking_family_id UUID REFERENCES families(id),
    defending_family_id UUID REFERENCES families(id),
    war_status TEXT DEFAULT 'pending' CHECK (war_status IN ('pending', 'active', 'completed', 'cancelled')),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    target_streamer_id UUID REFERENCES user_profiles(id),
    war_rules JSONB DEFAULT '{}',
    attacking_score INTEGER DEFAULT 0,
    defending_score INTEGER DEFAULT 0,
    winner_family_id UUID REFERENCES families(id),
    reward_coins INTEGER DEFAULT 0,
    reward_xp INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 8. War participation tracking
CREATE TABLE IF NOT EXISTS war_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    war_id UUID REFERENCES family_wars(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    participation_type TEXT CHECK (participation_type IN ('attacker', 'defender')),
    actions_taken JSONB DEFAULT '[]', -- list of actions performed
    score_contributed INTEGER DEFAULT 0,
    reward_claimed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Family rewards and unlocks
CREATE TABLE IF NOT EXISTS family_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('entrance_effect', 'profile_frame', 'emoji_pack', 'coin_multiplier', 'clan_vault_boost')),
    reward_name TEXT NOT NULL,
    reward_icon TEXT,
    reward_value JSONB DEFAULT '{}', -- effect parameters, frame URL, etc.
    unlock_condition TEXT,
    unlock_progress INTEGER DEFAULT 0,
    unlock_target INTEGER,
    is_unlocked BOOLEAN DEFAULT false,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Family leaderboard and statistics
CREATE TABLE IF NOT EXISTS family_leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    ranking_period TEXT DEFAULT 'weekly' CHECK (ranking_period IN ('daily', 'weekly', 'monthly', 'all_time')),
    period_start DATE,
    period_end DATE,
    total_xp INTEGER DEFAULT 0,
    total_coins_earned INTEGER DEFAULT 0,
    total_coins_spent INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    wars_won INTEGER DEFAULT 0,
    wars_lost INTEGER DEFAULT 0,
    member_count INTEGER DEFAULT 0,
    recruiting_bonus INTEGER DEFAULT 0,
    leaderboard_position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Family invite/QR system
CREATE TABLE IF NOT EXISTS family_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    invite_code TEXT UNIQUE NOT NULL,
    invite_type TEXT DEFAULT 'qr' CHECK (invite_type IN ('qr', 'link', 'direct')),
    created_by UUID REFERENCES user_profiles(id),
    max_uses INTEGER DEFAULT 10,
    uses_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Family chat system (enhanced)
ALTER TABLE family_lounge_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'system', 'announcement', 'task_update', 'war_update'));
ALTER TABLE family_lounge_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_families_family_code ON families(family_code);
CREATE INDEX IF NOT EXISTS idx_families_xp ON families(xp DESC);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_tasks_family_id ON family_tasks_new(family_id);
CREATE INDEX IF NOT EXISTS idx_family_tasks_status ON family_tasks_new(status);
CREATE INDEX IF NOT EXISTS idx_task_completions_task_id ON task_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_family_wars_war_type ON family_wars(war_type);
CREATE INDEX IF NOT EXISTS idx_family_wars_winner ON family_wars(winner_family_id);
CREATE INDEX IF NOT EXISTS idx_family_leaderboard_period ON family_leaderboard(ranking_period, period_start);

-- Row Level Security Policies
-- Families table
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view active families" ON families FOR SELECT USING (is_active = true);
CREATE POLICY "Family members can view their family" ON families FOR SELECT USING (
  id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
CREATE POLICY "Family founders can update their family" ON families FOR UPDATE USING (
  founder_id = auth.uid()
);

-- Family members table
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view family members" ON family_members FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
CREATE POLICY "Royal Troll can manage family members" ON family_members FOR ALL USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid() AND is_royal_troll = true)
);
CREATE POLICY "Users can manage their own membership" ON family_members FOR ALL USING (user_id = auth.uid());

-- Family tasks table
ALTER TABLE family_tasks_new ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family members can view family tasks" ON family_tasks_new FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
CREATE POLICY "Royal Troll can manage family tasks" ON family_tasks_new FOR ALL USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid() AND is_royal_troll = true)
);

-- Task completions table
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view task completions" ON task_completions FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create their task completions" ON task_completions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Royal Troll can verify completions" ON task_completions FOR UPDATE USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid() AND is_royal_troll = true)
);

-- Family wars table
ALTER TABLE family_wars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view family wars" ON family_wars FOR SELECT USING (
  attacking_family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()) OR
  defending_family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);

-- War participants table
ALTER TABLE war_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view war participants" ON war_participants FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can join wars" ON war_participants FOR INSERT WITH CHECK (user_id = auth.uid());

-- Family rewards table
ALTER TABLE family_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view family rewards" ON family_rewards FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
CREATE POLICY "Royal Troll can manage rewards" ON family_rewards FOR ALL USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid() AND is_royal_troll = true)
);

-- Family leaderboard table
ALTER TABLE family_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view family leaderboard" ON family_leaderboard FOR SELECT USING (true);

-- Family invites table
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view family invites" ON family_invites FOR SELECT USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
CREATE POLICY "Royal Troll can manage invites" ON family_invites FOR ALL USING (
  family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid() AND is_royal_troll = true)
);
CREATE POLICY "Anyone can use active invites" ON family_invites FOR UPDATE WITH CHECK (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

-- Grant permissions
GRANT SELECT ON families TO anon, authenticated;
GRANT SELECT ON family_members TO anon, authenticated;
GRANT SELECT ON family_tasks_new TO anon, authenticated;
GRANT SELECT ON task_completions TO anon, authenticated;
GRANT SELECT ON family_wars TO anon, authenticated;
GRANT SELECT ON war_participants TO anon, authenticated;
GRANT SELECT ON family_rewards TO anon, authenticated;
GRANT SELECT ON family_leaderboard TO anon, authenticated;
GRANT SELECT ON family_invites TO anon, authenticated;
GRANT SELECT ON family_ranks TO anon, authenticated;
GRANT SELECT ON task_templates TO anon, authenticated;

-- Create functions for automatic rank progression
CREATE OR REPLACE FUNCTION update_family_member_rank()
RETURNS TRIGGER AS $$
BEGIN
  -- Update member rank based on XP
  UPDATE family_members 
  SET rank_name = (
    SELECT name FROM family_ranks 
    WHERE NEW.xp_earned >= min_xp 
    AND (max_xp IS NULL OR NEW.xp_earned < max_xp)
    ORDER BY level DESC 
    LIMIT 1
  )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for rank updates
CREATE TRIGGER update_member_rank_trigger
    AFTER UPDATE OF xp_earned ON family_members
    FOR EACH ROW
    EXECUTE FUNCTION update_family_member_rank();

-- Create function for family XP updates
CREATE OR REPLACE FUNCTION update_family_xp()
RETURNS TRIGGER AS $$
BEGIN
  -- Update family total XP when member earns XP
  UPDATE families 
  SET xp = xp + NEW.reward_xp
  WHERE id = NEW.family_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for family XP updates
CREATE TRIGGER update_family_xp_trigger
    AFTER INSERT ON task_completions
    FOR EACH ROW
    EXECUTE FUNCTION update_family_xp();