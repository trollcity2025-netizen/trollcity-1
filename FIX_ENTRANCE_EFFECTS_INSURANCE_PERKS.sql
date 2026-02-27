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
  category TEXT,
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

INSERT INTO entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, image_url, is_active, category) VALUES
  ('effect_soft_glow', 'Soft Glow', '✨', 100, 'Common', 'Subtle pink/purple glow fade-in', 'soft_glow', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=soft%20pink%20glow%20aura&image_size=square', true, 'female_style'),
  ('effect_spark_step', 'Spark Step', '👠', 250, 'Common', 'Small sparkles appear with footsteps', 'spark_step', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=sparkles%20footsteps%20neon&image_size=square', true, 'female_style'),
  ('effect_heart_drift', 'Heart Drift', '💖', 400, 'Common', 'Floating hearts dissolve upward', 'heart_drift', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=floating%20hearts%20neon&image_size=square', true, 'female_style'),
  ('effect_rose_petals', 'Rose Petals', '🌹', 650, 'Uncommon', 'Rose petals fall briefly', 'rose_petals', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=falling%20rose%20petals&image_size=square', true, 'female_style'),
  ('effect_lip_gloss_flash', 'Lip Gloss Flash', '💄', 900, 'Uncommon', 'Light shimmer flash on entrance', 'lip_gloss_flash', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=shimmer%20flash%20glitter&image_size=square', true, 'female_style'),
  ('effect_halo_pop', 'Halo Pop', '😇', 1200, 'Rare', 'Thin halo appears then fades', 'halo_pop', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=angel%20halo%20glowing&image_size=square', true, 'female_style'),
  ('effect_crown_flicker', 'Crown Flicker', '👑', 2000, 'Rare', 'Crown outline flickers once', 'crown_flicker', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=crown%20outline%20neon&image_size=square', true, 'female_style'),
  ('effect_diamond_drop', 'Diamond Drop', '💎', 3500, 'Epic', 'Single diamond falls and shatters', 'diamond_drop', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=diamond%20falling%20shatter&image_size=square', true, 'female_style'),
  ('effect_runway_light', 'Runway Light', '🔦', 5000, 'Epic', 'Spotlight sweep across avatar', 'runway_light', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=spotlight%20sweep%20across%20avatar&image_size=square', true, 'female_style'),
  ('effect_queen_arrival', 'Queen Arrival', '👸', 10000, 'Legendary', 'Gold crown + applause sound', 'queen_arrival', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=queen%20arrival%20gold%20crown&image_size=square', true, 'female_style'),
  ('effect_shadow_step', 'Shadow Step', '🌑', 100, 'Common', 'Dark shadow ripple', 'shadow_step', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=shadow%20ripple%20dark&image_size=square', true, 'male_style'),
  ('effect_bass_thump', 'Bass Thump', '🔊', 250, 'Common', 'Low bass pulse effect', 'bass_thump', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=bass%20pulse%20shockwave&image_size=square', true, 'male_style'),
  ('effect_smoke_fade', 'Smoke Fade', '💨', 500, 'Uncommon', 'Smoke clears around avatar', 'smoke_fade', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=smoke%20clearing%20dark&image_size=square', true, 'male_style'),
  ('effect_power_stance', 'Power Stance', '💥', 800, 'Uncommon', 'Ground shock ring', 'power_stance', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=ground%20shock%20ring%20cracks&image_size=square', true, 'male_style'),
  ('effect_neon_outline', 'Neon Outline', '👤', 1200, 'Rare', 'Neon body outline flicker', 'neon_outline', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=neon%20body%20outline%20blue&image_size=square', true, 'male_style'),
  ('effect_ember_sparks', 'Ember Sparks', '🔥', 2000, 'Rare', 'Red embers float upward', 'ember_sparks', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=red%20embers%20floating&image_size=square', true, 'male_style'),
  ('effect_thunder_crack', 'Thunder Crack', '⚡', 3500, 'Epic', 'Lightning crack sound', 'thunder_crack', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=lightning%20bolt%20crack&image_size=square', true, 'male_style'),
  ('effect_alpha_entry', 'Alpha Entry', '🦁', 5000, 'Epic', 'Heavy stomp + glow', 'alpha_entry', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=heavy%20stomp%20impact%20glow&image_size=square', true, 'male_style'),
  ('effect_kingpin_walk', 'Kingpin Walk', '🕴️', 7500, 'Legendary', 'Red carpet roll-out', 'kingpin_walk', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=red%20carpet%20rollout&image_size=square', true, 'male_style'),
  ('effect_apex_arrival', 'Apex Arrival', '👑', 10000, 'Legendary', 'Full cinematic pause', 'apex_arrival', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=cinematic%20spotlight%20arrival&image_size=square', true, 'male_style'),
  ('effect_wrench_pop', 'Wrench Pop', '🔧', 100, 'Common', 'Floating wrench spins', 'wrench_pop', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=floating%20wrench%20tool&image_size=square', true, 'mechanics'),
  ('effect_metal_sparks', 'Metal Sparks', '✨', 300, 'Common', 'Welding sparks', 'metal_sparks', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=welding%20sparks%20bright&image_size=square', true, 'mechanics'),
  ('effect_oil_drip', 'Oil Drip', '🛢️', 600, 'Uncommon', 'Oil splash animation', 'oil_drip', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=oil%20splash%20black&image_size=square', true, 'mechanics'),
  ('effect_tool_belt', 'Tool Belt', '🛠️', 900, 'Uncommon', 'Tool icons appear', 'tool_belt', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=tools%20icons%20floating&image_size=square', true, 'mechanics'),
  ('effect_engine_rev', 'Engine Rev', '⚙️', 1500, 'Rare', 'Engine rev sound', 'engine_rev', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=engine%20piston%20moving&image_size=square', true, 'mechanics'),
  ('effect_piston_slam', 'Piston Slam', '🔨', 2500, 'Rare', 'Piston stomp', 'piston_slam', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=mechanical%20piston%20slam&image_size=square', true, 'mechanics'),
  ('effect_garage_lights', 'Garage Lights', '💡', 4000, 'Epic', 'Fluorescent flicker', 'garage_lights', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=fluorescent%20lights%20flicker&image_size=square', true, 'mechanics'),
  ('effect_industrial_fog', 'Industrial Fog', '🌫️', 6000, 'Epic', 'Thick workshop fog', 'industrial_fog', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=industrial%20fog%20steam&image_size=square', true, 'mechanics'),
  ('effect_master_mechanic', 'Master Mechanic', '👨‍🔧', 10000, 'Legendary', 'Full shop animation', 'master_mechanic', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=mechanic%20workshop%20scene&image_size=square', true, 'mechanics'),
  ('effect_smoke_puff', 'Smoke Puff', '☁️', 100, 'Common', 'Soft cloud puff', 'smoke_puff', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=soft%20smoke%20puff&image_size=square', true, 'stoners'),
  ('effect_green_drift', 'Green Drift', '🍃', 300, 'Common', 'Green mist', 'green_drift', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=green%20mist%20haze&image_size=square', true, 'stoners'),
  ('effect_ember_glow', 'Ember Glow', '🔥', 600, 'Uncommon', 'Warm ember aura', 'ember_glow', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=warm%20ember%20glow&image_size=square', true, 'stoners'),
  ('effect_calm_waves', 'Calm Waves', '🌊', 1000, 'Uncommon', 'Slow wave distortion', 'calm_waves', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=calm%20waves%20distortion&image_size=square', true, 'stoners'),
  ('effect_bong_bubble', 'Bong Bubble', '🫧', 1500, 'Rare', 'Bubble pop effect', 'bong_bubble', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=bubbles%20rising%20water&image_size=square', true, 'stoners'),
  ('effect_psy_ripple', 'Psy Ripple', '🌀', 2500, 'Rare', 'Psychedelic ripple', 'psy_ripple', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=psychedelic%20ripple%20colors&image_size=square', true, 'stoners'),
  ('effect_zen_entrance', 'Zen Entrance', '🧘', 4000, 'Epic', 'Ambient chime + fade', 'zen_entrance', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=zen%20garden%20peaceful&image_size=square', true, 'stoners'),
  ('effect_cosmic_chill', 'Cosmic Chill', '🌌', 7000, 'Epic', 'Nebula overlay', 'cosmic_chill', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=nebula%20space%20stars&image_size=square', true, 'stoners'),
  ('effect_high_ascension', 'High Ascension', '🚀', 10000, 'Legendary', 'Full slow-motion float', 'high_ascension', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=floating%20ascension%20clouds&image_size=square', true, 'stoners'),
  ('effect_ice_clink', 'Ice Clink', '🧊', 100, 'Common', 'Ice sound', 'ice_clink', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=ice%20cubes%20glass&image_size=square', true, 'drinkers'),
  ('effect_beer_foam', 'Beer Foam', '🍺', 300, 'Common', 'Foam splash', 'beer_foam', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=beer%20foam%20splash&image_size=square', true, 'drinkers'),
  ('effect_glass_raise', 'Glass Raise', '🥂', 600, 'Uncommon', 'Toast animation', 'glass_raise', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=toasting%20glasses%20cheers&image_size=square', true, 'drinkers'),
  ('effect_neon_bar', 'Neon Bar', '🍸', 1000, 'Uncommon', 'Bar light flicker', 'neon_bar', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=neon%20bar%20sign&image_size=square', true, 'drinkers'),
  ('effect_whiskey_smoke', 'Whiskey Smoke', '🥃', 2000, 'Rare', 'Barrel smoke', 'whiskey_smoke', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=whiskey%20glass%20smoke&image_size=square', true, 'drinkers'),
  ('effect_party_flash', 'Party Flash', '🎉', 3500, 'Rare', 'Strobe pulse', 'party_flash', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=disco%20strobe%20lights&image_size=square', true, 'drinkers'),
  ('effect_club_drop', 'Club Drop', '🎧', 5000, 'Epic', 'DJ bass hit', 'club_drop', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=dj%20turntable%20bass&image_size=square', true, 'drinkers'),
  ('effect_vip_bottle', 'VIP Bottle', '🍾', 7500, 'Epic', 'Bottle spark spray', 'vip_bottle', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=champagne%20bottle%20sparkler&image_size=square', true, 'drinkers'),
  ('effect_nightlife_king', 'Nightlife King', '🕺', 10000, 'Legendary', 'Full club entrance', 'nightlife_king', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=nightclub%20entrance%20vip&image_size=square', true, 'drinkers'),
  ('effect_tire_smoke', 'Tire Smoke', '💨', 100, 'Common', 'Tire smoke puff', 'tire_smoke', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=tire%20smoke%20burnout&image_size=square', true, 'cars'),
  ('effect_rev_start', 'Rev Start', '🏎️', 300, 'Common', 'Engine rev', 'rev_start', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=car%20engine%20revving&image_size=square', true, 'cars'),
  ('effect_neon_underglow', 'Neon Underglow', '🚘', 700, 'Uncommon', 'Underglow effect', 'neon_underglow', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=car%20neon%20underglow&image_size=square', true, 'cars'),
  ('effect_burnout_ring', 'Burnout Ring', '🍩', 1500, 'Uncommon', 'Burnout animation', 'burnout_ring', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=car%20burnout%20circle&image_size=square', true, 'cars'),
  ('effect_gear_shift', 'Gear Shift', '🕹️', 2500, 'Rare', 'Gear click sound', 'gear_shift', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=gear%20stick%20shift&image_size=square', true, 'cars'),
  ('effect_turbo_blowoff', 'Turbo Blowoff', '🐌', 3500, 'Rare', 'Turbo burst', 'turbo_blowoff', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=turbo%20charger%20flame&image_size=square', true, 'cars'),
  ('effect_drift_slide', 'Drift Slide', '🛞', 5000, 'Epic', 'Sliding motion', 'drift_slide', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=car%20drifting%20sideways&image_size=square', true, 'cars'),
  ('effect_garage_king', 'Garage King', '🏰', 7500, 'Epic', 'Lift + lights', 'garage_king', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=luxury%20garage%20showroom&image_size=square', true, 'cars'),
  ('effect_supercar_arrival', 'Supercar Arrival', '🏁', 10000, 'Legendary', 'Cinematic rev', 'supercar_arrival', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=supercar%20cinematic%20lights&image_size=square', true, 'cars'),
  ('effect_paw_prints', 'Paw Prints', '🐾', 100, 'Common', 'Paw trail', 'paw_prints', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=paw%20prints%20trail&image_size=square', true, 'animals'),
  ('effect_bird_chirp', 'Bird Chirp', '🐦', 300, 'Common', 'Bird sound', 'bird_chirp', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=singing%20bird%20note&image_size=square', true, 'animals'),
  ('effect_cat_stretch', 'Cat Stretch', '🐱', 600, 'Uncommon', 'Cat animation', 'cat_stretch', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=cat%20stretching%20silhouette&image_size=square', true, 'animals'),
  ('effect_puppy_hop', 'Puppy Hop', '🐶', 900, 'Uncommon', 'Dog hop', 'puppy_hop', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=happy%20puppy%20jumping&image_size=square', true, 'animals'),
  ('effect_wing_flutter', 'Wing Flutter', '🦋', 1500, 'Rare', 'Wings briefly', 'wing_flutter', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=butterfly%20wings%20flutter&image_size=square', true, 'animals'),
  ('effect_wolf_howl', 'Wolf Howl', '🐺', 2500, 'Rare', 'Howl sound', 'wolf_howl', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=wolf%20howling%20moon&image_size=square', true, 'animals'),
  ('effect_eagle_glide', 'Eagle Glide', '🦅', 4000, 'Epic', 'Shadow flyover', 'eagle_glide', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=eagle%20shadow%20flying&image_size=square', true, 'animals'),
  ('effect_lion_roar', 'Lion Roar', '🦁', 7500, 'Epic', 'Lion roar sound', 'lion_roar', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=lion%20roar%20african%20savanna&image_size=square', true, 'animals'),
  ('effect_dragon_arrival', 'Dragon Arrival', '🐉', 10000, 'Legendary', 'Dragon fly-by', 'dragon_arrival', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=dragon%20flying%20fantasy&image_size=square', true, 'animals'),
  ('effect_robot_glitch', 'Robot Glitch', '🤖', 100, 'Common', 'Glitch sound', 'robot_glitch', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=robot%20glitch%20error&image_size=square', true, 'tech_and_gaming'),
  ('effect_pixel_burst', 'Pixel Burst', '👾', 300, 'Common', 'Pixel explosion', 'pixel_burst', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=pixel%20explosion%20retro', true, 'tech_and_gaming'),
  ('effect_hologram_fade', 'Hologram Fade', ' projected from the ground', 600, 'Uncommon', 'Hologram effect', 'hologram_fade', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=hologram%20fade%20sci-fi', true, 'tech_and_gaming'),
  ('effect_code_rain', 'Code Rain', '👨‍💻', 900, 'Uncommon', 'Matrix-like code rain', 'code_rain', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=matrix%20code%20rain', true, 'tech_and_gaming'),
  ('effect_laser_grid', 'Laser Grid', '🚨', 1500, 'Rare', 'Laser grid scan', 'laser_grid', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=laser%20grid%20scan%20neon', true, 'tech_and_gaming'),
  ('effect_circuit_flow', 'Circuit Flow', '⚡', 2500, 'Rare', 'Circuit board animation', 'circuit_flow', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=circuit%20board%20flow%20neon', true, 'tech_and_gaming'),
  ('effect_virtual_reality', 'Virtual Reality', '🕶️', 4000, 'Epic', 'VR headset appear', 'virtual_reality', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=virtual%20reality%20headset%20neon', true, 'tech_and_gaming'),
  ('effect_ai_awakening', 'AI Awakening', '🧠', 7500, 'Epic', 'AI brain scan', 'ai_awakening', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=ai%20brain%20scan%20neon', true, 'tech_and_gaming'),
  ('effect_cyberpunk_entrance', 'Cyberpunk Entrance', '🌃', 10000, 'Legendary', 'Cyberpunk city animation', 'cyberpunk_entrance', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=cyberpunk%20city%20neon', true, 'tech_and_gaming'),
  ('effect_music_note_burst', 'Music Note Burst', '🎶', 100, 'Common', 'Music note explosion', 'music_note_burst', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=music%20note%20explosion', true, 'music_and_art'),
  ('effect_paint_splash', 'Paint Splash', '🎨', 300, 'Common', 'Paint splash effect', 'paint_splash', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=paint%20splash%20colorful', true, 'music_and_art'),
  ('effect_spotlight_reveal', 'Spotlight Reveal', '💡', 600, 'Uncommon', 'Stage spotlight reveal', 'spotlight_reveal', 'https://trae-api-us.mchost.guru/api/ide/v1/image/generate?prompt=stage%20spotlight%20reveal', true, 'music_and_art'),
  ('effect_microphone_drop', 'Microphone Drop', '🎤', 900, 'Uncommon', 'Mic drop effect', 'microphone_drop', 'https://trae-api-us.mchost.guru/api/ide/v1/image/generate?prompt=microphone%20drop', true, 'music_and_art'),
  ('effect_disco_ball', 'Disco Ball', '🕺', 1500, 'Rare', 'Disco ball lights', 'disco_ball', 'https://trae-api-us.mchost.guru/api/ide/v1/image/generate?prompt=disco%20ball%20lights', true, 'music_and_art'),
  ('effect_graffiti_tag', 'Graffiti Tag', ' spray painting on wall', 2500, 'Rare', 'Graffiti tag appears', 'graffiti_tag', 'https://trae-api-us.mchost.guru/api/ide/v1/image/generate?prompt=graffiti%20tag%20neon', true, 'music_and_art'),
  ('effect_symphony_orchestra', 'Symphony Orchestra', '🎻', 4000, 'Epic', 'Orchestra music + notes', 'symphony_orchestra', 'https://trae-api-us.mchost.guru/api/ide/v1/image/generate?prompt=symphony%20orchestra', true, 'music_and_art'),
  ('effect_art_exhibition', 'Art Exhibition', '🖼️', 7500, 'Epic', 'Art gallery reveal', 'art_exhibition', 'https://trae-api-us.mchost.guru/api/ide/v1/image/generate?prompt=art%20exhibition', true, 'music_and_art'),
  ('effect_rockstar_entrance', 'Rockstar Entrance', '🎸', 10000, 'Legendary', 'Rockstar stage dive', 'rockstar_entrance', 'https://trae-api-us.mchost.guru/api/ide/v1/image/generate?prompt=rockstar%20entrance', true, 'music_and_art')
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
  ('insurance_kick_24h', 'Kick Insurance (24h)', 1200, 'Protect from kick penalties for 24 hours', 24, 'kick'),
  ('insurance_full_24h', 'Full Protection (24h)', 2500, 'Complete protection for 24 hours', 24, 'full'),
  ('insurance_full_week', 'Full Protection (1 Week)', 15000, 'Full Protection (1 Week)', 168, 'full')
ON CONFLICT (id) DO NOTHING;

-- ==============================================
-- 11. VERIFICATION
-- ==============================================

SELECT 'Entrance Effects' as table_name, COUNT(*) as count FROM entrance_effects
UNION ALL
SELECT 'Perks', COUNT(*) FROM perks
UNION ALL
SELECT 'Insurance Options', COUNT(*) FROM insurance_options;
