-- ============================================================
-- NEXT-GENERATION LIVE STREAMING SYSTEM
-- Missions, Recognition, Profile Frames, Diamond Avatars,
-- Voice-Over, Custom Audio, Broadcaster Command Center
-- ============================================================

-- =====================
-- 1. MISSION SYSTEM
-- =====================

CREATE TABLE IF NOT EXISTS mission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('solo', 'community', 'competitive', 'timed')),
  category TEXT NOT NULL DEFAULT 'engagement',
  target_metric TEXT NOT NULL, -- e.g. 'gifts_sent', 'chat_messages', 'watch_minutes', 'coins_earned', 'follows', 'shares'
  target_value INTEGER NOT NULL,
  duration_minutes INTEGER, -- NULL for non-timed missions
  chain_order INTEGER DEFAULT 0, -- for chain missions
  chain_group TEXT, -- groups chain missions together
  difficulty TEXT NOT NULL DEFAULT 'normal' CHECK (difficulty IN ('easy', 'normal', 'hard', 'extreme', 'legendary')),
  xp_reward INTEGER DEFAULT 0,
  coin_reward INTEGER DEFAULT 0,
  badge_reward TEXT, -- slug of badge to award
  icon TEXT DEFAULT '🎯',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stream_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  mission_template_id UUID REFERENCES mission_templates(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('solo', 'community', 'competitive', 'timed')),
  target_metric TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  current_value INTEGER DEFAULT 0,
  difficulty TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'expired', 'chained')),
  chain_group TEXT,
  chain_order INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  xp_reward INTEGER DEFAULT 0,
  coin_reward INTEGER DEFAULT 0,
  icon TEXT DEFAULT '🎯',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stream_missions_stream ON stream_missions(stream_id, status);
CREATE INDEX idx_stream_missions_chain ON stream_missions(chain_group, chain_order);

CREATE TABLE IF NOT EXISTS user_mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES stream_missions(id) ON DELETE CASCADE,
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  progress_value INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, mission_id)
);

CREATE INDEX idx_user_mission_progress_user ON user_mission_progress(user_id, stream_id);

-- Mission progress tracking function
CREATE OR REPLACE FUNCTION update_mission_progress(
  p_stream_id UUID,
  p_user_id UUID,
  p_metric TEXT,
  p_value INTEGER
) RETURNS JSONB AS $$
DECLARE
  mission RECORD;
  user_prog RECORD;
  result JSONB := '{"updated": [], "completed": []}';
BEGIN
  -- Loop through active missions for this stream matching the metric
  FOR mission IN
    SELECT * FROM stream_missions
    WHERE stream_id = p_stream_id
    AND status = 'active'
    AND target_metric = p_metric
    AND (expires_at IS NULL OR expires_at > now())
  LOOP
    -- Update stream-level progress
    UPDATE stream_missions
    SET current_value = LEAST(current_value + p_value, target_value),
        status = CASE WHEN current_value + p_value >= target_value THEN 'completed' ELSE status END,
        completed_at = CASE WHEN current_value + p_value >= target_value THEN now() ELSE completed_at END
    WHERE id = mission.id;

    -- For solo/competitive missions, track individual progress
    IF mission.mission_type IN ('solo', 'competitive') THEN
      INSERT INTO user_mission_progress (user_id, mission_id, stream_id, progress_value)
      VALUES (p_user_id, mission.id, p_stream_id, p_value)
      ON CONFLICT (user_id, mission_id)
      DO UPDATE SET progress_value = LEAST(user_mission_progress.progress_value + p_value, mission.target_value),
                    completed_at = CASE WHEN user_mission_progress.progress_value + p_value >= mission.target_value THEN now() ELSE NULL END;
    END IF;

    -- Check if mission completed and handle chain escalation
    IF mission.current_value + p_value >= mission.target_value THEN
      result := jsonb_set(result, '{completed}', (result->'completed') || to_jsonb(mission.id));

      -- Auto-escalate chain missions
      IF mission.chain_group IS NOT NULL THEN
        UPDATE stream_missions
        SET status = 'active',
            starts_at = now()
        WHERE stream_id = p_stream_id
        AND chain_group = mission.chain_group
        AND chain_order = mission.chain_order + 1
        AND status = 'chained';
      END IF;
    END IF;

    result := jsonb_set(result, '{updated}', (result->'updated') || to_jsonb(mission.id));
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-generate missions for a stream
CREATE OR REPLACE FUNCTION generate_stream_missions(p_stream_id UUID)
RETURNS VOID AS $$
DECLARE
  template RECORD;
BEGIN
  -- Insert missions from active templates
  FOR template IN
    SELECT * FROM mission_templates
    WHERE is_active = true
    ORDER BY difficulty, chain_group, chain_order
  LOOP
    INSERT INTO stream_missions (
      stream_id, mission_template_id, name, description, mission_type,
      target_metric, target_value, difficulty, chain_group, chain_order,
      status, expires_at, xp_reward, coin_reward, icon
    ) VALUES (
      p_stream_id, template.id, template.name, template.description, template.mission_type,
      template.target_metric, template.target_value, template.difficulty,
      template.chain_group, template.chain_order,
      CASE WHEN template.chain_order > 0 THEN 'chained' ELSE 'active' END,
      CASE WHEN template.duration_minutes IS NOT NULL THEN now() + (template.duration_minutes || ' minutes')::INTERVAL ELSE NULL END,
      template.xp_reward, template.coin_reward, template.icon
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed mission templates
INSERT INTO mission_templates (slug, name, description, mission_type, target_metric, target_value, duration_minutes, difficulty, xp_reward, coin_reward, icon) VALUES
-- Solo missions
('send-5-gifts', 'Gift Giver', 'Send 5 gifts in this stream', 'solo', 'gifts_sent', 5, NULL, 'easy', 50, 10, '🎁'),
('send-20-gifts', 'Generous Spirit', 'Send 20 gifts in this stream', 'solo', 'gifts_sent', 20, NULL, 'normal', 150, 50, '💎'),
('send-50-gifts', 'Gift Legend', 'Send 50 gifts in this stream', 'solo', 'gifts_sent', 50, NULL, 'hard', 500, 200, '👑'),
('chat-10-messages', 'Chatterbox', 'Send 10 chat messages', 'solo', 'chat_messages', 10, NULL, 'easy', 30, 5, '💬'),
('chat-50-messages', 'Talk of the Town', 'Send 50 chat messages', 'solo', 'chat_messages', 50, NULL, 'normal', 100, 25, '🗣️'),
('watch-15-min', 'Loyal Viewer', 'Watch for 15 minutes', 'solo', 'watch_minutes', 15, NULL, 'easy', 40, 10, '👁️'),
('watch-60-min', 'Dedicated Fan', 'Watch for 60 minutes', 'solo', 'watch_minutes', 60, NULL, 'normal', 200, 50, '🏆'),
('share-stream', 'Spread the Word', 'Share this stream once', 'solo', 'shares', 1, NULL, 'easy', 25, 5, '📢'),
-- Community missions
('community-100-gifts', 'Community Gift Storm', 'Collectively send 100 gifts', 'community', 'gifts_sent', 100, NULL, 'normal', 100, 0, '🌪️'),
('community-500-gifts', 'Gift Tsunami', 'Collectively send 500 gifts', 'community', 'gifts_sent', 500, NULL, 'hard', 300, 0, '🌊'),
('community-1000-messages', 'Chat Explosion', 'Collectively send 1000 chat messages', 'community', 'chat_messages', 1000, NULL, 'normal', 200, 0, '💥'),
('community-50-viewers', 'Packed House', 'Reach 50 concurrent viewers', 'community', 'viewer_count', 50, NULL, 'normal', 150, 0, '🏠'),
('community-100-viewers', 'Standing Room Only', 'Reach 100 concurrent viewers', 'community', 'viewer_count', 100, NULL, 'hard', 500, 0, '🎭'),
-- Competitive missions
('top-gifter-5min', 'Speed Gifter', 'Be the top gifter in 5 minutes', 'competitive', 'gifts_sent', 10, 5, 'hard', 200, 100, '⚡'),
('first-to-10-messages', 'First to Talk', 'First to send 10 messages', 'competitive', 'chat_messages', 10, NULL, 'normal', 75, 25, '🥇'),
-- Timed missions
('timed-50-gifts-10min', 'Gift Rush', 'Send 50 gifts in 10 minutes', 'timed', 'gifts_sent', 50, 10, 'extreme', 500, 300, '🚀'),
('timed-200-messages-5min', 'Chat Frenzy', 'Community sends 200 messages in 5 minutes', 'timed', 'chat_messages', 200, 5, 'hard', 300, 0, '🔥'),
-- Chain missions (Gift Chain)
('chain-gift-1', 'Gift Chain: Step 1', 'Send 5 gifts to start the chain', 'solo', 'gifts_sent', 5, NULL, 'easy', 30, 10, '⛓️'),
('chain-gift-2', 'Gift Chain: Step 2', 'Send 15 gifts total', 'solo', 'gifts_sent', 15, NULL, 'normal', 75, 30, '⛓️'),
('chain-gift-3', 'Gift Chain: Step 3', 'Send 30 gifts total', 'solo', 'gifts_sent', 30, NULL, 'hard', 200, 100, '⛓️'),
('chain-gift-4', 'Gift Chain: Final Step', 'Send 50 gifts total', 'solo', 'gifts_sent', 50, NULL, 'legendary', 500, 300, '🔗');

-- Add chain group to chain missions
UPDATE mission_templates SET chain_group = 'gift-chain', chain_order = 1 WHERE slug = 'chain-gift-1';
UPDATE mission_templates SET chain_group = 'gift-chain', chain_order = 2 WHERE slug = 'chain-gift-2';
UPDATE mission_templates SET chain_group = 'gift-chain', chain_order = 3 WHERE slug = 'chain-gift-3';
UPDATE mission_templates SET chain_group = 'gift-chain', chain_order = 4 WHERE slug = 'chain-gift-4';


-- =====================
-- 2. PROFILE FRAME SYSTEM (2000 LEVELS)
-- =====================

CREATE TABLE IF NOT EXISTS profile_frame_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL,
  min_level INTEGER NOT NULL,
  max_level INTEGER NOT NULL,
  frame_style TEXT NOT NULL DEFAULT 'flat', -- flat, beveled, glowing, animated, premium
  border_color TEXT DEFAULT '#666666',
  border_gradient TEXT,
  glow_color TEXT,
  glow_intensity REAL DEFAULT 0,
  animation_type TEXT, -- pulse, rotate, shimmer, fire, electric, cosmic
  animation_speed TEXT DEFAULT 'normal', -- slow, normal, fast
  has_particles BOOLEAN DEFAULT false,
  particle_color TEXT,
  css_class TEXT,
  rarity TEXT DEFAULT 'common',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed 2000-level frame tiers
INSERT INTO profile_frame_tiers (tier_name, min_level, max_level, frame_style, border_color, glow_color, glow_intensity, animation_type, rarity, css_class) VALUES
('Novice', 1, 10, 'flat', '#4a5568', NULL, 0, NULL, 'common', 'frame-novice'),
('Apprentice', 11, 25, 'flat', '#6366f1', '#6366f1', 0.2, NULL, 'common', 'frame-apprentice'),
('Journeyman', 26, 50, 'beveled', '#8b5cf6', '#8b5cf6', 0.3, NULL, 'uncommon', 'frame-journeyman'),
('Adept', 51, 100, 'beveled', '#a855f7', '#a855f7', 0.4, 'pulse', 'uncommon', 'frame-adept'),
('Expert', 101, 200, 'glowing', '#ec4899', '#ec4899', 0.5, 'pulse', 'rare', 'frame-expert'),
('Master', 201, 350, 'glowing', '#f43f5e', '#f43f5e', 0.6, 'shimmer', 'rare', 'frame-master'),
('Grandmaster', 351, 500, 'animated', '#f97316', '#f97316', 0.7, 'shimmer', 'epic', 'frame-grandmaster'),
('Champion', 501, 700, 'animated', '#eab308', '#eab308', 0.8, 'rotate', 'epic', 'frame-champion'),
('Titan', 701, 900, 'premium', '#facc15', '#facc15', 0.9, 'fire', 'legendary', 'frame-titan'),
('Immortal', 901, 1100, 'premium', '#ffd700', '#ffd700', 1.0, 'fire', 'legendary', 'frame-immortal'),
('Divine', 1101, 1300, 'premium', '#ffd700', '#ff6b35', 1.1, 'electric', 'mythic', 'frame-divine'),
('Celestial', 1301, 1500, 'premium', '#ff6b35', '#00d4ff', 1.2, 'cosmic', 'mythic', 'frame-celestial'),
('Cosmic', 1501, 1700, 'premium', '#00d4ff', '#a855f7', 1.3, 'cosmic', 'exclusive', 'frame-cosmic'),
('Eternal', 1701, 1900, 'premium', '#a855f7', '#ffd700', 1.4, 'cosmic', 'exclusive', 'frame-eternal'),
('Transcendent', 1901, 2000, 'premium', '#ffd700', '#ff3366', 1.5, 'cosmic', 'ultimate', 'frame-transcendent');

-- Function to get frame for level
CREATE OR REPLACE FUNCTION get_profile_frame(p_level INTEGER)
RETURNS SETOF profile_frame_tiers AS $$
  SELECT * FROM profile_frame_tiers
  WHERE p_level >= min_level AND p_level <= max_level
  LIMIT 1;
$$ LANGUAGE sql STABLE;


-- =====================
-- 3. DIAMOND AVATAR SYSTEM
-- =====================

CREATE TABLE IF NOT EXISTS diamond_avatar_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL,
  min_level INTEGER NOT NULL,
  max_level INTEGER NOT NULL,
  diamond_style TEXT NOT NULL DEFAULT 'flat', -- flat, beveled, glowing, crystal, artifact
  border_color TEXT DEFAULT '#666666',
  border_gradient TEXT,
  glow_color TEXT,
  glow_intensity REAL DEFAULT 0,
  has_sparkle BOOLEAN DEFAULT false,
  sparkle_color TEXT,
  animation TEXT, -- pulse, rotate, shimmer, fire, crystal_glow, artifact_pulse
  animation_speed TEXT DEFAULT 'normal',
  css_class TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed diamond tiers
INSERT INTO diamond_avatar_tiers (tier_name, min_level, max_level, diamond_style, border_color, glow_color, glow_intensity, has_sparkle, animation, css_class) VALUES
('Flat Diamond', 1, 50, 'flat', '#4a5568', NULL, 0, false, NULL, 'diamond-flat'),
('Beveled Diamond', 51, 200, 'beveled', '#8b5cf6', '#8b5cf6', 0.3, false, NULL, 'diamond-beveled'),
('Glowing Crystal', 201, 500, 'glowing', '#a855f7', '#a855f7', 0.5, true, 'pulse', 'diamond-glowing'),
('Crystal Gem', 501, 1000, 'crystal', '#ec4899', '#ec4899', 0.7, true, 'shimmer', 'diamond-crystal'),
('Animated Gemstone', 1001, 1500, 'crystal', '#eab308', '#ffd700', 0.9, true, 'fire', 'diamond-animated'),
('Ultimate Artifact', 1501, 2000, 'artifact', '#ffd700', '#ff3366', 1.2, true, 'artifact_pulse', 'diamond-artifact');

-- Special diamond overrides
CREATE TABLE IF NOT EXISTS diamond_special_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  css_class TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('top_buyer', 'top_broadcaster', 'mvp', 'custom')),
  border_gradient TEXT,
  glow_color TEXT,
  glow_intensity REAL DEFAULT 1.0,
  animation TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO diamond_special_styles (slug, name, description, css_class, trigger_type, border_gradient, glow_color, glow_intensity, animation) VALUES
('luxury-diamond', 'Luxury Diamond', 'For top buyers', 'diamond-luxury', 'top_buyer', 'linear-gradient(135deg, #ffd700, #ff6b35)', '#ffd700', 1.0, 'shimmer'),
('iconic-diamond', 'Iconic Diamond', 'For top broadcasters', 'diamond-iconic', 'top_broadcaster', 'linear-gradient(135deg, #00d4ff, #a855f7)', '#00d4ff', 1.0, 'pulse'),
('mvp-diamond', 'MVP Diamond', 'For MVPs', 'diamond-mvp', 'mvp', 'linear-gradient(135deg, #ff3366, #ffd700)', '#ff3366', 1.2, 'pulse');


-- =====================
-- 4. VOICE-OVER & CUSTOM AUDIO SYSTEM
-- =====================

CREATE TABLE IF NOT EXISTS user_entrance_audio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  audio_name TEXT DEFAULT 'My Entrance',
  duration_seconds REAL NOT NULL CHECK (duration_seconds >= 1 AND duration_seconds <= 6),
  file_size_bytes INTEGER,
  is_active BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT true, -- moderation
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_entrance_audio_user ON user_entrance_audio(user_id, is_active);

-- Voice-over announcements config
CREATE TABLE IF NOT EXISTS voice_announcement_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  voice_type TEXT NOT NULL, -- hype, premium, futuristic, branded
  sample_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO voice_announcement_styles (slug, name, voice_type) VALUES
('hype-male', 'Hype Male', 'hype'),
('hype-female', 'Hype Female', 'hype'),
('premium-dj', 'Premium DJ', 'premium'),
('premium-announcer', 'Premium Announcer', 'premium'),
('futuristic-ai', 'Futuristic AI', 'futuristic'),
('branded-troll', 'Branded Troll City', 'branded');

-- Audio queue for managing join announcements
CREATE TABLE IF NOT EXISTS audio_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  audio_type TEXT NOT NULL CHECK (audio_type IN ('custom', 'voice_over', 'system')),
  audio_url TEXT,
  voice_text TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'playing', 'played', 'skipped', 'dropped')),
  created_at TIMESTAMPTZ DEFAULT now(),
  played_at TIMESTAMPTZ
);

CREATE INDEX idx_audio_queue_stream ON audio_queue(stream_id, status, priority DESC, created_at);

-- Broadcast audio settings
CREATE TABLE IF NOT EXISTS broadcast_audio_settings (
  stream_id UUID PRIMARY KEY REFERENCES streams(id) ON DELETE CASCADE,
  voice_enabled BOOLEAN DEFAULT true,
  custom_audio_enabled BOOLEAN DEFAULT true,
  min_level_for_voice INTEGER DEFAULT 200,
  min_level_for_custom INTEGER DEFAULT 200,
  cooldown_seconds INTEGER DEFAULT 5,
  max_queue_size INTEGER DEFAULT 10,
  stream_mode TEXT DEFAULT 'standard' CHECK (stream_mode IN ('silent', 'standard', 'premium', 'hype')),
  muted_users UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Priority calculation function for audio queue
CREATE OR REPLACE FUNCTION calculate_audio_priority(
  p_user_id UUID,
  p_stream_id UUID,
  p_audio_type TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_level INTEGER;
  v_is_top_buyer BOOLEAN := false;
  v_is_top_broadcaster BOOLEAN := false;
  v_is_event_winner BOOLEAN := false;
  v_priority INTEGER := 0;
BEGIN
  -- Get user level
  SELECT COALESCE(level, 1) INTO v_level FROM user_profiles WHERE id = p_user_id;

  -- Check special statuses (simplified - would check actual data)
  SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = p_user_id AND total_spent_coins > 50000) INTO v_is_top_buyer;
  SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = p_user_id AND total_streams > 100) INTO v_is_top_broadcaster;

  -- Priority system (highest first):
  -- 1. Event winner = 1000
  -- 2. Top broadcaster = 900
  -- 3. Top buyer = 800
  -- 4. Level 1000+ = 700
  -- 5. Level 200+ custom audio = 600
  -- 6. Level 200+ voice-over = 500
  -- 7. Default = 100

  IF v_is_event_winner THEN v_priority := 1000;
  ELSIF v_is_top_broadcaster THEN v_priority := 900;
  ELSIF v_is_top_buyer THEN v_priority := 800;
  ELSIF v_level >= 1000 THEN v_priority := 700;
  ELSIF v_level >= 200 AND p_audio_type = 'custom' THEN v_priority := 600;
  ELSIF v_level >= 200 AND p_audio_type = 'voice_over' THEN v_priority := 500;
  ELSE v_priority := 100;
  END IF;

  RETURN v_priority;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================
-- 5. RECOGNITION SYSTEM
-- =====================

CREATE TABLE IF NOT EXISTS stream_fan_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'viewer' CHECK (tier IN ('viewer', 'supporter', 'fan', 'superfan', 'legend', 'icon')),
  total_coins_gifted INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  watch_minutes INTEGER DEFAULT 0,
  hype_score INTEGER DEFAULT 0,
  role TEXT DEFAULT NULL, -- hype_leader, judge, co_host, etc.
  contract_active BOOLEAN DEFAULT false,
  contract_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stream_id, user_id)
);

CREATE INDEX idx_stream_fan_tiers_stream ON stream_fan_tiers(stream_id, tier);
CREATE INDEX idx_stream_fan_tiers_user ON stream_fan_tiers(user_id);

-- Energy meter (hype system)
CREATE TABLE IF NOT EXISTS stream_energy_meter (
  stream_id UUID PRIMARY KEY REFERENCES streams(id) ON DELETE CASCADE,
  energy_level INTEGER DEFAULT 0 CHECK (energy_level >= 0 AND energy_level <= 100),
  hype_multiplier REAL DEFAULT 1.0,
  last_boost_at TIMESTAMPTZ,
  total_boosts INTEGER DEFAULT 0,
  peak_energy INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stream awards (end-of-stream)
CREATE TABLE IF NOT EXISTS stream_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  award_type TEXT NOT NULL, -- mvp, top_gifter, most_active, hype_king, loyal_viewer, rising_star
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  xp_reward INTEGER DEFAULT 0,
  coin_reward INTEGER DEFAULT 0,
  badge_awarded TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stream_awards_stream ON stream_awards(stream_id);

-- Fan memory (per-broadcaster history)
CREATE TABLE IF NOT EXISTS fan_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_streams_watched INTEGER DEFAULT 0,
  total_coins_gifted INTEGER DEFAULT 0,
  total_messages_sent INTEGER DEFAULT 0,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  loyalty_score INTEGER DEFAULT 0,
  best_tier TEXT DEFAULT 'viewer',
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(broadcaster_id, fan_id)
);

CREATE INDEX idx_fan_memory_broadcaster ON fan_memory(broadcaster_id, loyalty_score DESC);

-- Fan contracts
CREATE TABLE IF NOT EXISTS fan_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL DEFAULT 'standard', -- standard, premium, exclusive
  perks JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fan_contracts_broadcaster ON fan_contracts(broadcaster_id, is_active);

-- Update fan tier based on activity
CREATE OR REPLACE FUNCTION update_fan_tier(p_stream_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_tier TEXT := 'viewer';
  v_coins INTEGER;
  v_messages INTEGER;
  v_watch INTEGER;
  v_hype INTEGER;
BEGIN
  SELECT total_coins_gifted, total_messages, watch_minutes, hype_score
  INTO v_coins, v_messages, v_watch, v_hype
  FROM stream_fan_tiers
  WHERE stream_id = p_stream_id AND user_id = p_user_id;

  IF v_coins IS NULL THEN RETURN 'viewer'; END IF;

  -- Tier calculation
  IF v_coins >= 10000 OR v_hype >= 500 THEN v_tier := 'icon';
  ELSIF v_coins >= 5000 OR v_hype >= 300 THEN v_tier := 'legend';
  ELSIF v_coins >= 1000 OR v_hype >= 150 THEN v_tier := 'superfan';
  ELSIF v_coins >= 200 OR v_messages >= 50 THEN v_tier := 'fan';
  ELSIF v_coins >= 50 OR v_messages >= 20 THEN v_tier := 'supporter';
  END IF;

  UPDATE stream_fan_tiers SET tier = v_tier, updated_at = now()
  WHERE stream_id = p_stream_id AND user_id = p_user_id;

  RETURN v_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate energy meter
CREATE OR REPLACE FUNCTION boost_stream_energy(p_stream_id UUID, p_boost INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_new_energy INTEGER;
BEGIN
  INSERT INTO stream_energy_meter (stream_id, energy_level, last_boost_at, total_boosts)
  VALUES (p_stream_id, LEAST(p_boost, 100), now(), 1)
  ON CONFLICT (stream_id)
  DO UPDATE SET
    energy_level = LEAST(stream_energy_meter.energy_level + p_boost, 100),
    last_boost_at = now(),
    total_boosts = stream_energy_meter.total_boosts + 1,
    peak_energy = GREATEST(stream_energy_meter.peak_energy, LEAST(stream_energy_meter.energy_level + p_boost, 100)),
    updated_at = now()
  RETURNING energy_level INTO v_new_energy;

  RETURN v_new_energy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================
-- 6. BROADCASTER COMMAND CENTER
-- =====================

CREATE TABLE IF NOT EXISTS broadcast_command_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL CHECK (module_type IN (
    'identity', 'goals', 'missions', 'top_fans',
    'milestones', 'polls', 'interactions', 'recognition',
    'energy_meter', 'ticker'
  )),
  is_enabled BOOLEAN DEFAULT true,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 300,
  height INTEGER DEFAULT 200,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_broadcast_modules_stream ON broadcast_command_modules(stream_id, is_enabled);

-- Stream goals
CREATE TABLE IF NOT EXISTS stream_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('coins', 'followers', 'shares', 'subscriptions', 'gifts', 'viewers')),
  title TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  current_value INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  completed_at TIMESTAMPTZ,
  reward_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stream_goals_stream ON stream_goals(stream_id, is_active);

-- Stream milestones (unlockable achievements)
CREATE TABLE IF NOT EXISTS stream_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  threshold INTEGER NOT NULL,
  is_unlocked BOOLEAN DEFAULT false,
  unlocked_at TIMESTAMPTZ,
  icon TEXT DEFAULT '🏆',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stream polls
CREATE TABLE IF NOT EXISTS stream_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- [{label: 'A', votes: 0}, {label: 'B', votes: 0}]
  is_active BOOLEAN DEFAULT true,
  total_votes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_stream_polls_stream ON stream_polls(stream_id, is_active);

-- Default command center modules for new streams
CREATE OR REPLACE FUNCTION setup_default_command_center(p_stream_id UUID, p_broadcaster_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO broadcast_command_modules (broadcaster_id, stream_id, module_type, position_x, position_y, width, height) VALUES
    (p_broadcaster_id, p_stream_id, 'identity', 0, 0, 400, 150),
    (p_broadcaster_id, p_stream_id, 'goals', 0, 160, 400, 200),
    (p_broadcaster_id, p_stream_id, 'missions', 410, 0, 400, 350),
    (p_broadcaster_id, p_stream_id, 'top_fans', 0, 370, 400, 250),
    (p_broadcaster_id, p_stream_id, 'milestones', 410, 360, 400, 200),
    (p_broadcaster_id, p_stream_id, 'energy_meter', 820, 0, 200, 150),
    (p_broadcaster_id, p_stream_id, 'ticker', 0, 630, 810, 60);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================
-- 7. BADGE TIER ENHANCEMENTS
-- =====================

ALTER TABLE badge_catalog ADD COLUMN IF NOT EXISTS tier_level INTEGER DEFAULT 1;
ALTER TABLE badge_catalog ADD COLUMN IF NOT EXISTS max_tier INTEGER DEFAULT 1;
ALTER TABLE badge_catalog ADD COLUMN IF NOT EXISTS tier_progress_required INTEGER DEFAULT 0;
ALTER TABLE badge_catalog ADD COLUMN IF NOT EXISTS perk_type TEXT;
ALTER TABLE badge_catalog ADD COLUMN IF NOT EXISTS perk_value JSONB;

-- Badge tier progress tracking
CREATE TABLE IF NOT EXISTS user_badge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_slug TEXT NOT NULL,
  current_tier INTEGER DEFAULT 1,
  progress_value INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_slug)
);

CREATE INDEX idx_user_badge_progress_user ON user_badge_progress(user_id);


-- =====================
-- 8. ENHANCED ENTRANCE EFFECTS (Audio Integration)
-- =====================

-- Add voice-over text to entrance effects
ALTER TABLE entrance_effects ADD COLUMN IF NOT EXISTS voice_over_text TEXT;
ALTER TABLE entrance_effects ADD COLUMN IF NOT EXISTS voice_style TEXT DEFAULT 'hype';
ALTER TABLE entrance_effects ADD COLUMN IF NOT EXISTS min_level INTEGER DEFAULT 1;
ALTER TABLE entrance_effects ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- User settings for entrance audio
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS entrance_audio_enabled BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS entrance_join_type TEXT DEFAULT 'effect' CHECK (entrance_join_type IN ('audio', 'voice', 'effect', 'none'));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS active_entrance_audio_id UUID REFERENCES user_entrance_audio(id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS voice_announcement_enabled BOOLEAN DEFAULT true;


-- =====================
-- 9. RLS POLICIES
-- =====================

-- Mission templates (public read)
ALTER TABLE mission_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mission templates are readable by everyone" ON mission_templates FOR SELECT USING (true);

-- Stream missions (public read)
ALTER TABLE stream_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stream missions are readable by everyone" ON stream_missions FOR SELECT USING (true);

-- User mission progress
ALTER TABLE user_mission_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own mission progress" ON user_mission_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own mission progress" ON user_mission_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own mission progress" ON user_mission_progress FOR UPDATE USING (auth.uid() = user_id);

-- Profile frames (public read)
ALTER TABLE profile_frame_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profile frames are readable by everyone" ON profile_frame_tiers FOR SELECT USING (true);

-- Diamond tiers (public read)
ALTER TABLE diamond_avatar_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Diamond tiers are readable by everyone" ON diamond_avatar_tiers FOR SELECT USING (true);

ALTER TABLE diamond_special_styles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Diamond special styles are readable by everyone" ON diamond_special_styles FOR SELECT USING (true);

-- User entrance audio
ALTER TABLE user_entrance_audio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own entrance audio" ON user_entrance_audio FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Approved entrance audio is readable by everyone" ON user_entrance_audio FOR SELECT USING (is_approved = true);

-- Audio queue
ALTER TABLE audio_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audio queue is readable by everyone" ON audio_queue FOR SELECT USING (true);

-- Broadcast audio settings
ALTER TABLE broadcast_audio_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Broadcast audio settings are readable by everyone" ON broadcast_audio_settings FOR SELECT USING (true);

-- Stream fan tiers
ALTER TABLE stream_fan_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fan tiers are readable by everyone" ON stream_fan_tiers FOR SELECT USING (true);
CREATE POLICY "Users can update their own fan tier" ON stream_fan_tiers FOR ALL USING (auth.uid() = user_id);

-- Stream energy meter
ALTER TABLE stream_energy_meter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Energy meter is readable by everyone" ON stream_energy_meter FOR SELECT USING (true);

-- Stream awards
ALTER TABLE stream_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stream awards are readable by everyone" ON stream_awards FOR SELECT USING (true);

-- Fan memory
ALTER TABLE fan_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fan memory readable by involved parties" ON fan_memory FOR SELECT USING (auth.uid() = broadcaster_id OR auth.uid() = fan_id);
CREATE POLICY "Broadcaster can manage fan memory" ON fan_memory FOR ALL USING (auth.uid() = broadcaster_id);

-- Fan contracts
ALTER TABLE fan_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fan contracts readable by involved parties" ON fan_contracts FOR SELECT USING (auth.uid() = broadcaster_id OR auth.uid() = fan_id);

-- Command center modules
ALTER TABLE broadcast_command_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Command modules are readable by everyone" ON broadcast_command_modules FOR SELECT USING (true);
CREATE POLICY "Broadcaster can manage their modules" ON broadcast_command_modules FOR ALL USING (auth.uid() = broadcaster_id);

-- Stream goals
ALTER TABLE stream_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stream goals are readable by everyone" ON stream_goals FOR SELECT USING (true);

-- Stream milestones
ALTER TABLE stream_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stream milestones are readable by everyone" ON stream_milestones FOR SELECT USING (true);

-- Stream polls
ALTER TABLE stream_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stream polls are readable by everyone" ON stream_polls FOR SELECT USING (true);

-- User badge progress
ALTER TABLE user_badge_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own badge progress" ON user_badge_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own badge progress" ON user_badge_progress FOR ALL USING (auth.uid() = user_id);

-- Voice announcement styles
ALTER TABLE voice_announcement_styles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Voice styles are readable by everyone" ON voice_announcement_styles FOR SELECT USING (true);
