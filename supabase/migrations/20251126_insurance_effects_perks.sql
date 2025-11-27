-- Migration: Insurance, Entrance Effects, and Perks System
-- Created: 2025-11-26
-- Purpose: Add tables for insurance, entrance effects, and perks purchases

-- Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS user_insurances CASCADE;
DROP TABLE IF EXISTS user_perks CASCADE;
DROP TABLE IF EXISTS user_entrance_effects CASCADE;
DROP TABLE IF EXISTS insurance_options CASCADE;
DROP TABLE IF EXISTS perks CASCADE;
DROP TABLE IF EXISTS entrance_effects CASCADE;

-- =====================================================
-- 1. ENTRANCE EFFECTS (catalog)
-- =====================================================
CREATE TABLE entrance_effects (
  id TEXT PRIMARY KEY, -- e.g., 'effect_flame_burst'
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  coin_cost INTEGER NOT NULL CHECK (coin_cost >= 0),
  rarity TEXT NOT NULL CHECK (rarity IN ('Rare', 'Epic', 'Legendary', 'Mythic', 'Exclusive')),
  description TEXT,
  animation_type TEXT, -- 'flame', 'money_shower', 'electric', etc.
  sound_effect TEXT, -- URL or identifier for sound
  duration_seconds INTEGER DEFAULT 5, -- How long the effect displays
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. USER ENTRANCE EFFECTS (purchases/activations)
-- =====================================================
CREATE TABLE user_entrance_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  effect_id TEXT NOT NULL REFERENCES entrance_effects(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT false, -- Only one can be active at a time
  activation_count INTEGER DEFAULT 0, -- Track how many times used
  metadata JSONB DEFAULT '{}', -- Store effect_name, rarity, icon for quick access
  UNIQUE(user_id, effect_id)
);

CREATE INDEX idx_user_entrance_effects_user ON user_entrance_effects(user_id);
CREATE INDEX idx_user_entrance_effects_active ON user_entrance_effects(user_id) WHERE is_active = true;

-- =====================================================
-- 3. PERKS (catalog)
-- =====================================================
CREATE TABLE perks (
  id TEXT PRIMARY KEY, -- e.g., 'perk_ghost_mode'
  name TEXT NOT NULL,
  cost INTEGER NOT NULL CHECK (cost >= 0),
  description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL, -- 30, 60, 100, etc.
  icon TEXT,
  perk_type TEXT NOT NULL CHECK (perk_type IN ('visibility', 'chat', 'protection', 'boost', 'cosmetic')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. USER PERKS (purchases/activations)
-- =====================================================
CREATE TABLE user_perks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  perk_id TEXT NOT NULL REFERENCES perks(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- calculated from duration_minutes
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}', -- Store perk details
  UNIQUE(user_id, perk_id, purchased_at) -- Allow repurchasing same perk
);

CREATE INDEX idx_user_perks_user ON user_perks(user_id);
CREATE INDEX idx_user_perks_active ON user_perks(user_id) WHERE is_active = true;

-- Function to auto-expire perks
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

-- =====================================================
-- 5. INSURANCE OPTIONS (catalog)
-- =====================================================
CREATE TABLE insurance_options (
  id TEXT PRIMARY KEY, -- e.g., 'bankrupt_insurance_24h'
  name TEXT NOT NULL,
  cost INTEGER NOT NULL CHECK (cost >= 0),
  description TEXT NOT NULL,
  duration_hours INTEGER NOT NULL, -- 24, 48, 168 (1 week)
  protection_type TEXT NOT NULL CHECK (protection_type IN ('bankrupt', 'kick', 'full')),
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. USER INSURANCES (purchases/activations)
-- =====================================================
CREATE TABLE user_insurances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insurance_id TEXT NOT NULL REFERENCES insurance_options(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  protection_type TEXT NOT NULL,
  times_triggered INTEGER DEFAULT 0, -- How many times insurance was used
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, insurance_id, purchased_at) -- Allow repurchasing
);

CREATE INDEX idx_user_insurances_user ON user_insurances(user_id);
CREATE INDEX idx_user_insurances_active ON user_insurances(user_id) WHERE is_active = true;

-- Function to auto-expire insurances
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

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================

-- Entrance Effects (catalog) - public read
ALTER TABLE entrance_effects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active entrance effects"
  ON entrance_effects FOR SELECT
  USING (is_active = true);

-- User Entrance Effects - users can view/manage their own
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

-- Perks (catalog) - public read
ALTER TABLE perks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active perks"
  ON perks FOR SELECT
  USING (is_active = true);

-- User Perks - users can view/manage their own
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

-- Insurance Options (catalog) - public read
ALTER TABLE insurance_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active insurance options"
  ON insurance_options FOR SELECT
  USING (is_active = true);

-- User Insurances - users can view/manage their own
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

-- =====================================================
-- 8. SEED DATA
-- =====================================================

-- Insert entrance effects
INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type) VALUES
  ('effect_flame_burst', '🔥 Flame Burst', '🔥', 500, 'Rare', 'Enter with a burst of flames', 'flame'),
  ('effect_money_shower', '💸 Money Shower', '💸', 1500, 'Epic', 'Rain money when you arrive', 'money_shower'),
  ('effect_electric_flash', '⚡ Electric Flash', '⚡', 2800, 'Epic', 'Electric lightning entrance', 'electric'),
  ('effect_royal_throne', '👑 Royal Throne', '👑', 5200, 'Legendary', 'Descend on a royal throne', 'throne'),
  ('effect_rainbow_descent', '🌈 Rainbow Descent', '🌈', 8500, 'Legendary', 'Arrive on a rainbow', 'rainbow'),
  ('effect_troll_rollup', '🚗 Troll Roll-Up', '🚗', 12000, 'Mythic', 'Drive in with style', 'car'),
  ('effect_vip_siren', '🚨 VIP Siren Rush', '🚨', 25000, 'Mythic', 'VIP siren announcement', 'siren'),
  ('effect_firework', '🎆 Firework Explosion', '🎆', 50000, 'Mythic', 'Explode onto the scene', 'firework'),
  ('effect_troll_king', '🧌 Troll King Arrival', '🧌', 100000, 'Exclusive', 'Ultimate king entrance', 'king')
ON CONFLICT (id) DO NOTHING;

-- Insert perks
INSERT INTO perks (id, name, cost, description, duration_minutes, perk_type) VALUES
  ('perk_disappear_chat', 'Disappearing Chats (30m)', 500, 'Your chats auto-hide after 10s for 30 minutes', 30, 'visibility'),
  ('perk_ghost_mode', 'Ghost Mode (30m)', 1200, 'View streams in stealth without status indicators', 30, 'visibility'),
  ('perk_message_admin', 'Message Admin (Officer Only)', 250, 'Unlock DM to Admin', 10080, 'chat'),
  ('perk_global_highlight', 'Glowing Username (1h)', 8000, 'Your username glows neon in all chats & gift animations', 60, 'cosmetic'),
  ('perk_slowmo_chat', 'Slow-Motion Chat Control (5hrs)', 15000, 'Activate chat slow-mode in any live stream', 300, 'chat'),
  ('perk_troll_alarm', 'Troll Alarm Arrival (100hrs)', 2000, 'Sound + flash announces your arrival', 6000, 'cosmetic'),
  ('perk_ban_shield', 'Ban Shield (2hrs)', 1700, 'Immunity from kick, mute, or ban for 2 hours', 120, 'protection'),
  ('perk_double_xp', 'Double XP Mode (1h)', 1300, 'Earn 2x XP for the next hour', 60, 'boost'),
  ('perk_flex_banner', 'Golden Flex Banner (100h)', 3500, 'Golden crown banner on all your messages', 6000, 'cosmetic'),
  ('perk_troll_spell', 'Troll Spell (1h)', 2800, 'Randomly change another user''s username style & emoji for 100 hour', 60, 'cosmetic')
ON CONFLICT (id) DO NOTHING;

-- Insert insurance options
INSERT INTO insurance_options (id, name, cost, description, duration_hours, protection_type) VALUES
  ('insurance_bankrupt_24h', 'Bankrupt Insurance (24h)', 1500, 'Protect from wheel bankrupt for 24 hours', 24, 'bankrupt'),
  ('insurance_kick_24h', 'Kick Insurance (24h)', 1200, 'Protect from kick penalties for 24 hours', 24, 'kick'),
  ('insurance_full_24h', 'Full Protection (24h)', 2500, 'Complete protection for 24 hours', 24, 'full'),
  ('insurance_bankrupt_week', 'Bankrupt Insurance (1 Week)', 8000, 'Protect from wheel bankrupt for 1 week', 168, 'bankrupt'),
  ('insurance_full_week', 'Full Protection (1 Week)', 15000, 'Complete protection for 1 week', 168, 'full')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check tables exist
DO $$
BEGIN
  RAISE NOTICE 'Entrance Effects count: %', (SELECT COUNT(*) FROM entrance_effects);
  RAISE NOTICE 'Perks count: %', (SELECT COUNT(*) FROM perks);
  RAISE NOTICE 'Insurance Options count: %', (SELECT COUNT(*) FROM insurance_options);
END $$;
