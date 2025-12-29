-- ==============================================
-- FIX ENTRANCE EFFECTS, INSURANCE & PERKS
-- Copy and paste this entire file into Supabase SQL Editor
-- ==============================================

-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS user_insurances CASCADE;
DROP TABLE IF EXISTS user_perks CASCADE;
DROP TABLE IF EXISTS user_entrance_effects CASCADE;
DROP TABLE IF EXISTS insurance_options CASCADE;
DROP TABLE IF EXISTS perks CASCADE;
DROP TABLE IF EXISTS entrance_effects CASCADE;

-- ==============================================
-- 1. ENTRANCE EFFECTS (catalog)
-- ==============================================
CREATE TABLE entrance_effects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  coin_cost INTEGER NOT NULL CHECK (coin_cost >= 0),
  rarity TEXT NOT NULL,
  description TEXT,
  animation_type TEXT,
  sound_effect TEXT,
  duration_seconds INTEGER DEFAULT 5,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 2. USER ENTRANCE EFFECTS (purchases/activations)
-- ==============================================
CREATE TABLE user_entrance_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  effect_id TEXT NOT NULL REFERENCES entrance_effects(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT false,
  activation_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, effect_id)
);

CREATE INDEX idx_user_entrance_effects_user ON user_entrance_effects(user_id);
CREATE INDEX idx_user_entrance_effects_active ON user_entrance_effects(user_id) WHERE is_active = true;

-- ==============================================
-- 3. PERKS (catalog)
-- ==============================================
CREATE TABLE perks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cost INTEGER NOT NULL CHECK (cost >= 0),
  description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  icon TEXT,
  perk_type TEXT NOT NULL CHECK (perk_type IN ('visibility', 'chat', 'protection', 'boost', 'cosmetic')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 4. USER PERKS (purchases/activations)
-- ==============================================
CREATE TABLE user_perks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  perk_id TEXT NOT NULL REFERENCES perks(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, perk_id, purchased_at)
);

CREATE INDEX idx_user_perks_user ON user_perks(user_id);
CREATE INDEX idx_user_perks_active ON user_perks(user_id) WHERE is_active = true;

-- Auto-expire perks
CREATE OR REPLACE FUNCTION check_perk_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at <= NOW() THEN
    NEW.is_active = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_perk_expiry
  BEFORE INSERT OR UPDATE ON user_perks
  FOR EACH ROW
  EXECUTE FUNCTION check_perk_expiry();

-- ==============================================
-- 5. INSURANCE OPTIONS (catalog)
-- ==============================================
CREATE TABLE insurance_options (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cost INTEGER NOT NULL CHECK (cost >= 0),
  description TEXT NOT NULL,
  duration_hours INTEGER NOT NULL,
  protection_type TEXT NOT NULL CHECK (protection_type IN ('bankrupt', 'kick', 'full')),
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- 6. USER INSURANCES (purchases/activations)
-- ==============================================
CREATE TABLE user_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insurance_id TEXT NOT NULL REFERENCES insurance_options(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  protection_type TEXT NOT NULL,
  times_triggered INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, insurance_id, purchased_at)
);

CREATE INDEX idx_user_insurances_user ON user_insurances(user_id);
CREATE INDEX idx_user_insurances_active ON user_insurances(user_id) WHERE is_active = true;

-- Auto-expire insurances
CREATE OR REPLACE FUNCTION check_insurance_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at <= NOW() THEN
    NEW.is_active = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_insurance_expiry
  BEFORE INSERT OR UPDATE ON user_insurances
  FOR EACH ROW
  EXECUTE FUNCTION check_insurance_expiry();

-- ==============================================
-- 7. RLS POLICIES
-- ==============================================

ALTER TABLE entrance_effects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active entrance effects"
  ON entrance_effects FOR SELECT
  USING (is_active = true);

ALTER TABLE user_entrance_effects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own entrance effects"
  ON user_entrance_effects FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own entrance effects"
  ON user_entrance_effects FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own entrance effects"
  ON user_entrance_effects FOR UPDATE
  USING (auth.uid() = user_id);

ALTER TABLE perks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active perks"
  ON perks FOR SELECT
  USING (is_active = true);

ALTER TABLE user_perks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own perks"
  ON user_perks FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own perks"
  ON user_perks FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own perks"
  ON user_perks FOR UPDATE
  USING (auth.uid() = user_id);

ALTER TABLE insurance_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active insurance options"
  ON insurance_options FOR SELECT
  USING (is_active = true);

ALTER TABLE user_insurances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own insurances"
  ON user_insurances FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own insurances"
  ON user_insurances FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own insurances"
  ON user_insurances FOR UPDATE
  USING (auth.uid() = user_id);

-- ==============================================
-- 8. SEED DATA - ENTRANCE EFFECTS
-- ==============================================

INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, is_active) VALUES
  ('e1', 'Troll Entrance (Classic)', '🧌', 0, 'EXCLUSIVE', 'Classic troll entrance', 'troll_classic', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=classic%20troll%20entrance%20neon%20aura&image_size=square', true),
  ('e2', 'Royal Sparkle Crown', '👑', 5000, 'EPIC', 'Royal crown sparkles', 'sparkle_crown', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=royal%20sparkle%20crown%20neon%20gold&image_size=square', true),
  ('e3', 'Neon Meteor Shower', '☄️', 10000, 'MYTHIC', 'Neon meteor shower', 'meteor_shower', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=neon%20meteor%20shower%20cosmic&image_size=square', true),
  ('e4', 'Lightning Strike Arrival', '⚡', 7500, 'EPIC', 'Lightning strike arrival', 'lightning_arrival', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=lightning%20strike%20arrival%20neon&image_size=square', true),
  ('e5', 'Chaos Portal Arrival', '🌀', 15000, 'LEGENDARY', 'Chaos portal arrival', 'chaos_portal', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=chaos%20portal%20arrival%20neon%20warp&image_size=square', true),
  ('e6', 'Galactic Warp Beam', '🛸', 25000, 'ULTRA', 'Galactic warp beam', 'warp_beam', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=galactic%20warp%20beam%20neon&image_size=square', true),
  ('e7', 'Troll City VIP Flames', '🔥', 35000, 'LEGENDARY+', 'VIP flames', 'vip_flames', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=vip%20flames%20neon%20crown&image_size=square', true),
  ('e8', 'Flaming Gold Crown Drop', '👑', 50000, 'EXOTIC', 'Flaming gold crown drop', 'gold_crown_drop', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=flaming%20gold%20crown%20drop&image_size=square', true),
  ('e9', 'Aurora Storm Entrance', '🌌', 75000, 'MYTHIC', 'Aurora storm entrance', 'aurora_storm', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=aurora%20storm%20entrance&image_size=square', true),
  ('e10', 'Black Hole Vortex', '🕳️', 100000, 'ULTRA', 'Black hole vortex', 'black_hole', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=black%20hole%20vortex%20neon&image_size=square', true),
  ('e11', 'Money Shower Madness', '💸', 125000, 'RARE+', 'Money shower madness', 'money_shower', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=money%20shower%20madness%20neon&image_size=square', true),
  ('e12', 'Floating Royal Throne', '👑', 150000, 'MYTHIC', 'Floating royal throne', 'royal_throne', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=floating%20royal%20throne%20neon&image_size=square', true),
  ('e13', 'Platinum Fire Tornado', '🔥', 200000, 'LEGENDARY++', 'Platinum fire tornado', 'fire_tornado', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=platinum%20fire%20tornado%20neon&image_size=square', true),
  ('e14', 'Cosmic Crown Meteor Fall', '☄️', 250000, 'ULTRA', 'Cosmic crown meteor fall', 'crown_meteor', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=cosmic%20crown%20meteor%20fall&image_size=square', true),
  ('e15', 'Royal Diamond Explosion', '💎', 300000, 'EXOTIC', 'Royal diamond explosion', 'diamond_explosion', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=royal%20diamond%20explosion%20neon&image_size=square', true),
  ('e16', 'Neon Chaos Warp', '🌀', 400000, 'MYTHIC', 'Neon chaos warp', 'chaos_warp', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=neon%20chaos%20warp&image_size=square', true),
  ('e17', 'Supreme Emerald Storm', '💚', 500000, 'LEGENDARY++', 'Supreme emerald storm', 'emerald_storm', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=supreme%20emerald%20storm%20neon&image_size=square', true),
  ('e18', 'Millionaire Troller Arrival', '🤑', 1000000, 'EXOTIC GOLD', 'Millionaire troller arrival', 'millionaire_arrival', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=millionaire%20troller%20arrival%20neon&image_size=square', true),
  ('e19', 'Troll God Ascension', '🧌', 2500000, 'DIVINE', 'Troll god ascension', 'god_ascension', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=troll%20god%20ascension%20neon&image_size=square', true),
  ('e20', 'Troll City World Domination', '🌍', 5000000, 'UNOBTAINABLE', 'World domination', 'world_domination', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=world%20domination%20neon&image_size=square', true)
ON CONFLICT (id) DO NOTHING;

-- ==============================================
-- 9. SEED DATA - PERKS
-- ==============================================

INSERT INTO perks (id, name, cost, description, duration_minutes, perk_type) VALUES
  ('perk_disappear_chat', 'Disappearing Chats (30m)', 500, 'Your chats auto-hide after 10s for 30 minutes', 30, 'visibility'),
  ('perk_ghost_mode', 'Ghost Mode (30m)', 1200, 'View streams in stealth without status indicators', 30, 'visibility'),
  ('perk_message_admin', 'Message Admin (Officer Only)', 250, 'Unlock DM to Admin', 10080, 'chat'),
  ('perk_global_highlight', 'Glowing Username (1h)', 8000, 'Your username glows neon in all chats & gift animations', 60, 'cosmetic'),
  ('perk_rgb_username', 'RGB Username (24h)', 420, 'Rainbow glow visible to everyone', 1440, 'cosmetic'),
  ('perk_slowmo_chat', 'Slow-Motion Chat Control (5hrs)', 15000, 'Activate chat slow-mode in any live stream', 300, 'chat'),
  ('perk_troll_alarm', 'Troll Alarm Arrival (100hrs)', 2000, 'Sound + flash announces your arrival', 6000, 'cosmetic'),
  ('perk_ban_shield', 'Ban Shield (2hrs)', 1700, 'Immunity from kick, mute, or ban for 2 hours', 120, 'protection'),
  ('perk_double_xp', 'Double XP Mode (1h)', 1300, 'Earn 2x XP for the next hour', 60, 'boost'),
  ('perk_flex_banner', 'Golden Flex Banner (100h)', 3500, 'Golden crown banner on all your messages', 6000, 'cosmetic'),
  ('perk_troll_spell', 'Troll Spell (1h)', 2800, 'Randomly change another user''s username style & emoji for 100 hour', 60, 'cosmetic')
ON CONFLICT (id) DO NOTHING;

-- ==============================================
-- 10. SEED DATA - INSURANCE OPTIONS
-- ==============================================

INSERT INTO insurance_options (id, name, cost, description, duration_hours, protection_type) VALUES
  ('insurance_bankrupt_24h', 'Bankrupt Insurance (24h)', 1500, 'Protect from wheel bankrupt for 24 hours', 24, 'bankrupt'),
  ('insurance_kick_24h', 'Kick Insurance (24h)', 1200, 'Protect from kick penalties for 24 hours', 24, 'kick'),
  ('insurance_full_24h', 'Full Protection (24h)', 2500, 'Complete protection for 24 hours', 24, 'full'),
  ('insurance_bankrupt_week', 'Bankrupt Insurance (1 Week)', 8000, 'Protect from wheel bankrupt for 1 week', 168, 'bankrupt'),
  ('insurance_full_week', 'Full Protection (1 Week)', 15000, 'Complete protection for 1 week', 168, 'full')
ON CONFLICT (id) DO NOTHING;

-- ==============================================
-- 11. VERIFICATION
-- ==============================================

SELECT 'Entrance Effects' as table_name, COUNT(*) as count FROM entrance_effects
UNION ALL
SELECT 'Perks', COUNT(*) FROM perks
UNION ALL
SELECT 'Insurance Options', COUNT(*) FROM insurance_options;
