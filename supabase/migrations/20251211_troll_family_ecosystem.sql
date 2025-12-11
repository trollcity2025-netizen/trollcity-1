-- Troll Family Ecosystem Database Schema
-- Complete family system with coins, XP, tasks, wars, seasons, and shop

-- Enable RLS
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 1. troll_families table (extend if exists)
CREATE TABLE IF NOT EXISTS public.troll_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  emblem_url TEXT,
  banner_url TEXT,
  description TEXT,
  leader_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. family_members table
CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','officer','leader')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

-- 3. family_stats table
CREATE TABLE IF NOT EXISTS public.family_stats (
  family_id UUID PRIMARY KEY REFERENCES public.troll_families(id) ON DELETE CASCADE,
  total_coins BIGINT NOT NULL DEFAULT 0,
  weekly_coins BIGINT NOT NULL DEFAULT 0,
  season_coins BIGINT NOT NULL DEFAULT 0,
  xp BIGINT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. family_tasks table
CREATE TABLE IF NOT EXISTS public.family_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
  task_title TEXT NOT NULL,
  task_description TEXT,
  reward_family_coins BIGINT NOT NULL DEFAULT 0,
  reward_family_xp BIGINT NOT NULL DEFAULT 0,
  goal_value BIGINT NOT NULL DEFAULT 1,
  current_value BIGINT NOT NULL DEFAULT 0,
  metric TEXT NOT NULL DEFAULT 'generic',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. family_activity_log table
CREATE TABLE IF NOT EXISTS public.family_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  event_type TEXT NOT NULL,
  event_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. family_seasons table
CREATE TABLE IF NOT EXISTS public.family_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. family_wars table
CREATE TABLE IF NOT EXISTS public.family_wars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES public.family_seasons(id),
  family_a_id UUID NOT NULL REFERENCES public.troll_families(id),
  family_b_id UUID NOT NULL REFERENCES public.troll_families(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','cancelled')),
  created_by UUID REFERENCES public.profiles(id),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  winner_family_id UUID REFERENCES public.troll_families(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. family_war_scores table
CREATE TABLE IF NOT EXISTS public.family_war_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  war_id UUID NOT NULL REFERENCES public.family_wars(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
  score BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (war_id, family_id)
);

-- 9. family_shop_items table
CREATE TABLE IF NOT EXISTS public.family_shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  cost_family_coins BIGINT NOT NULL,
  unlock_type TEXT NOT NULL,
  unlock_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. family_shop_purchases table
CREATE TABLE IF NOT EXISTS public.family_shop_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.family_shop_items(id),
  purchased_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (family_id, item_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_tasks_family_id ON family_tasks(family_id);
CREATE INDEX IF NOT EXISTS idx_family_tasks_status ON family_tasks(status);
CREATE INDEX IF NOT EXISTS idx_family_activity_log_family_id ON family_activity_log(family_id);
CREATE INDEX IF NOT EXISTS idx_family_activity_log_created_at ON family_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_wars_status ON family_wars(status);
CREATE INDEX IF NOT EXISTS idx_family_wars_season_id ON family_wars(season_id);
CREATE INDEX IF NOT EXISTS idx_family_war_scores_war_id ON family_war_scores(war_id);
CREATE INDEX IF NOT EXISTS idx_family_shop_items_active ON family_shop_items(is_active);

-- RPC Function: increment_family_stats
-- Atomically updates family stats and handles leveling
CREATE OR REPLACE FUNCTION increment_family_stats(
  p_family_id UUID,
  p_coin_bonus BIGINT DEFAULT 0,
  p_xp_bonus BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_xp BIGINT;
  v_new_xp BIGINT;
  v_old_level INT;
  v_new_level INT;
  v_required_xp BIGINT;
BEGIN
  -- Get current stats
  SELECT xp, level INTO v_old_xp, v_old_level
  FROM family_stats
  WHERE family_id = p_family_id;

  -- If no stats exist, create them
  IF v_old_xp IS NULL THEN
    INSERT INTO family_stats (family_id, total_coins, weekly_coins, season_coins, xp, level)
    VALUES (p_family_id, p_coin_bonus, p_coin_bonus, p_coin_bonus, p_xp_bonus, 1);
    v_new_xp := p_xp_bonus;
    v_new_level := 1;
  ELSE
    -- Update stats
    UPDATE family_stats
    SET
      total_coins = total_coins + p_coin_bonus,
      weekly_coins = weekly_coins + p_coin_bonus,
      season_coins = season_coins + p_coin_bonus,
      xp = xp + p_xp_bonus,
      updated_at = NOW()
    WHERE family_id = p_family_id;

    v_new_xp := v_old_xp + p_xp_bonus;
    v_new_level := v_old_level;
  END IF;

  -- Check for level up (XP formula: level^2 * 1000)
  LOOP
    v_required_xp := v_new_level * v_new_level * 1000;
    EXIT WHEN v_new_xp < v_required_xp;
    v_new_level := v_new_level + 1;

    -- Log level up event
    INSERT INTO family_activity_log (family_id, event_type, event_message)
    VALUES (p_family_id, 'level_up', 'Family reached level ' || v_new_level || '!');
  END LOOP;

  -- Update level if changed
  IF v_new_level > v_old_level THEN
    UPDATE family_stats SET level = v_new_level WHERE family_id = p_family_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'old_level', v_old_level,
    'new_level', v_new_level,
    'leveled_up', v_new_level > v_old_level
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION increment_family_stats(UUID, BIGINT, BIGINT) TO authenticated;

-- RLS Policies
ALTER TABLE troll_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_wars ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_war_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_shop_purchases ENABLE ROW LEVEL SECURITY;

-- troll_families: authenticated users can read all, only leaders can update their family
CREATE POLICY "troll_families_select" ON troll_families
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "troll_families_insert" ON troll_families
  FOR INSERT WITH CHECK (auth.uid() = leader_id);

CREATE POLICY "troll_families_update" ON troll_families
  FOR UPDATE USING (
    auth.uid() = leader_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- family_members: users can see members of families they're in, leaders/officers can manage
CREATE POLICY "family_members_select" ON family_members
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id = family_members.family_id AND fm.user_id = auth.uid())
    )
  );

CREATE POLICY "family_members_insert" ON family_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM family_members WHERE family_id = family_members.family_id AND user_id = auth.uid() AND role IN ('leader', 'officer')) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "family_members_update" ON family_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM family_members WHERE family_id = family_members.family_id AND user_id = auth.uid() AND role IN ('leader', 'officer')) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- family_stats: members can read, leaders can update
CREATE POLICY "family_stats_select" ON family_stats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM family_members WHERE family_id = family_stats.family_id AND user_id = auth.uid())
  );

CREATE POLICY "family_stats_update" ON family_stats
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM family_members WHERE family_id = family_stats.family_id AND user_id = auth.uid() AND role IN ('leader', 'officer')) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- family_tasks: family members can read, leaders/officers can manage
CREATE POLICY "family_tasks_select" ON family_tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM family_members WHERE family_id = family_tasks.family_id AND user_id = auth.uid())
  );

CREATE POLICY "family_tasks_insert" ON family_tasks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM family_members WHERE family_id = family_tasks.family_id AND user_id = auth.uid() AND role IN ('leader', 'officer')) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "family_tasks_update" ON family_tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM family_members WHERE family_id = family_tasks.family_id AND user_id = auth.uid() AND role IN ('leader', 'officer')) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- family_activity_log: family members can read
CREATE POLICY "family_activity_log_select" ON family_activity_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM family_members WHERE family_id = family_activity_log.family_id AND user_id = auth.uid())
  );

CREATE POLICY "family_activity_log_insert" ON family_activity_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM family_members WHERE family_id = family_activity_log.family_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- family_seasons: everyone can read active seasons
CREATE POLICY "family_seasons_select" ON family_seasons
  FOR SELECT USING (auth.role() = 'authenticated');

-- family_wars: authenticated users can read wars involving families they're in
CREATE POLICY "family_wars_select" ON family_wars
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      EXISTS (SELECT 1 FROM family_members WHERE family_id = family_wars.family_a_id AND user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM family_members WHERE family_id = family_wars.family_b_id AND user_id = auth.uid())
    )
  );

-- family_war_scores: same as wars
CREATE POLICY "family_war_scores_select" ON family_war_scores
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM family_wars WHERE id = family_war_scores.war_id AND (
      EXISTS (SELECT 1 FROM family_members WHERE family_id = family_wars.family_a_id AND user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM family_members WHERE family_id = family_wars.family_b_id AND user_id = auth.uid())
    ))
  );

-- family_shop_items: everyone can read active items
CREATE POLICY "family_shop_items_select" ON family_shop_items
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

-- family_shop_purchases: family members can see their family's purchases
CREATE POLICY "family_shop_purchases_select" ON family_shop_purchases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM family_members WHERE family_id = family_shop_purchases.family_id AND user_id = auth.uid())
  );

CREATE POLICY "family_shop_purchases_insert" ON family_shop_purchases
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM family_members WHERE family_id = family_shop_purchases.family_id AND user_id = auth.uid() AND role IN ('leader', 'officer')) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Insert sample data for testing
INSERT INTO family_seasons (name, starts_at, ends_at, is_active) VALUES
('Season 1: Neon Uprising', NOW(), NOW() + INTERVAL '30 days', true)
ON CONFLICT DO NOTHING;

INSERT INTO family_shop_items (name, description, cost_family_coins, unlock_type, unlock_key) VALUES
('Royal Crown Badge', 'Exclusive golden crown badge for family champions', 50000, 'badge', 'royal_crown'),
('Neon Entrance Effect', 'Spectacular neon particle entrance animation', 75000, 'entrance_effect', 'neon_burst'),
('Legendary Profile Frame', 'Glowing legendary frame for profile pictures', 100000, 'profile_frame', 'legendary_glow'),
('Epic Family Banner', 'Custom animated banner for family page', 150000, 'banner', 'epic_banner'),
('VIP Chat Perks', 'Special chat colors and priority messaging', 200000, 'perk', 'vip_chat')
ON CONFLICT DO NOTHING;