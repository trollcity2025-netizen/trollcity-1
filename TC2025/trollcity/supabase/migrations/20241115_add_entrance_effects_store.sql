-- Add user_entrance_effects table and default entrance effects
-- This migration ensures all entrance effects are available in the store

-- Create user_entrance_effects table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_entrance_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  effect_id UUID NOT NULL REFERENCES entrance_effects(id) ON DELETE CASCADE,
  effect_name TEXT NOT NULL,
  effect_animation TEXT,
  effect_color TEXT,
  effect_intensity TEXT,
  purchased_price BIGINT NOT NULL,
  purchased_date TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_entrance_effects_user ON user_entrance_effects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_entrance_effects_effect ON user_entrance_effects(effect_id);
CREATE INDEX IF NOT EXISTS idx_user_entrance_effects_purchased ON user_entrance_effects(purchased_date DESC);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_entrance_effects TO anon, authenticated;

-- Add some default entrance effects to the store
INSERT INTO entrance_effects (user_id, effect_name, effect_emoji, cost, duration_seconds) VALUES
-- Common effects (100-1000 coins)
('00000000-0000-0000-0000-000000000000', 'Sparkle Entrance', '✨', 100, 3),
('00000000-0000-0000-0000-000000000000', 'Star Burst', '⭐', 150, 3),
('00000000-0000-0000-0000-000000000000', 'Neon Glow', '💫', 200, 4),
('00000000-0000-0000-0000-000000000000', 'Rainbow Trail', '🌈', 250, 4),
('00000000-0000-0000-0000-000000000000', 'Fire Entrance', '🔥', 300, 3),

-- Rare effects (500-2500 coins)
('00000000-0000-0000-0000-000000000000', 'Lightning Strike', '⚡', 500, 4),
('00000000-0000-0000-0000-000000000000', 'Ice Crystal', '❄️', 750, 5),
('00000000-0000-0000-0000-000000000000', 'Dragon Roar', '🐉', 1000, 5),
('00000000-0000-0000-0000-000000000000', 'Phoenix Rise', '🔥', 1500, 6),
('00000000-0000-0000-0000-000000000000', 'Cosmic Portal', '🌌', 2000, 6),

-- Epic effects (2500-10000 coins)
('00000000-0000-0000-0000-000000000000', 'Royal Crown', '👑', 2500, 5),
('00000000-0000-0000-0000-000000000000', 'Golden Shower', '💰', 3000, 4),
('00000000-0000-0000-0000-000000000000', 'Mystic Aura', '🔮', 4000, 6),
('00000000-0000-0000-0000-000000000000', 'Thunder God', '⚡', 5000, 7),
('00000000-0000-0000-0000-000000000000', 'Angel Wings', '🪽', 7500, 6),

-- Legendary effects (10000+ coins)
('00000000-0000-0000-0000-000000000000', 'Legendary Entrance', '🏆', 10000, 8),
('00000000-0000-0000-0000-000000000000', 'God Mode', '👼', 15000, 10),
('00000000-0000-0000-0000-000000000000', 'Universe Creator', '🌟', 25000, 12),
('00000000-0000-0000-0000-000000000000', 'Time Warp', '⏰', 50000, 15),
('00000000-0000-0000-0000-000000000000', 'Eternal Glory', '💎', 100000, 20);

-- Add animation types and colors to existing effects
UPDATE entrance_effects SET
  effect_animation = CASE 
    WHEN effect_name LIKE '%Sparkle%' THEN 'sparkle'
    WHEN effect_name LIKE '%Star%' THEN 'burst'
    WHEN effect_name LIKE '%Neon%' THEN 'glow'
    WHEN effect_name LIKE '%Rainbow%' THEN 'trail'
    WHEN effect_name LIKE '%Fire%' OR effect_name LIKE '%Phoenix%' THEN 'fire'
    WHEN effect_name LIKE '%Lightning%' OR effect_name LIKE '%Thunder%' THEN 'lightning'
    WHEN effect_name LIKE '%Ice%' THEN 'ice'
    WHEN effect_name LIKE '%Dragon%' THEN 'dragon'
    WHEN effect_name LIKE '%Cosmic%' OR effect_name LIKE '%Portal%' THEN 'portal'
    WHEN effect_name LIKE '%Royal%' OR effect_name LIKE '%Crown%' THEN 'crown'
    WHEN effect_name LIKE '%Golden%' THEN 'gold'
    WHEN effect_name LIKE '%Mystic%' OR effect_name LIKE '%Aura%' THEN 'aura'
    WHEN effect_name LIKE '%Angel%' OR effect_name LIKE '%Wings%' THEN 'wings'
    WHEN effect_name LIKE '%Legendary%' THEN 'legendary'
    WHEN effect_name LIKE '%God%' THEN 'god'
    WHEN effect_name LIKE '%Universe%' THEN 'universe'
    WHEN effect_name LIKE '%Time%' THEN 'time'
    WHEN effect_name LIKE '%Eternal%' THEN 'eternal'
    ELSE 'sparkle'
  END,
  effect_color = CASE 
    WHEN effect_name LIKE '%Sparkle%' THEN 'gold'
    WHEN effect_name LIKE '%Star%' THEN 'white'
    WHEN effect_name LIKE '%Neon%' THEN 'cyan'
    WHEN effect_name LIKE '%Rainbow%' THEN 'rainbow'
    WHEN effect_name LIKE '%Fire%' OR effect_name LIKE '%Phoenix%' THEN 'orange'
    WHEN effect_name LIKE '%Lightning%' OR effect_name LIKE '%Thunder%' THEN 'yellow'
    WHEN effect_name LIKE '%Ice%' THEN 'blue'
    WHEN effect_name LIKE '%Dragon%' THEN 'red'
    WHEN effect_name LIKE '%Cosmic%' OR effect_name LIKE '%Portal%' THEN 'purple'
    WHEN effect_name LIKE '%Royal%' OR effect_name LIKE '%Crown%' THEN 'gold'
    WHEN effect_name LIKE '%Golden%' THEN 'gold'
    WHEN effect_name LIKE '%Mystic%' OR effect_name LIKE '%Aura%' THEN 'purple'
    WHEN effect_name LIKE '%Angel%' OR effect_name LIKE '%Wings%' THEN 'white'
    WHEN effect_name LIKE '%Legendary%' THEN 'gold'
    WHEN effect_name LIKE '%God%' THEN 'white'
    WHEN effect_name LIKE '%Universe%' THEN 'blue'
    WHEN effect_name LIKE '%Time%' THEN 'purple'
    WHEN effect_name LIKE '%Eternal%' THEN 'diamond'
    ELSE 'gold'
  END,
  effect_intensity = CASE 
    WHEN cost <= 500 THEN 'low'
    WHEN cost <= 2500 THEN 'medium'
    WHEN cost <= 10000 THEN 'high'
    ELSE 'extreme'
  END
WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- Create a function to get all available entrance effects for the store
CREATE OR REPLACE FUNCTION get_store_entrance_effects()
RETURNS TABLE (
  id UUID,
  effect_name TEXT,
  effect_emoji TEXT,
  cost BIGINT,
  duration_seconds INT,
  effect_animation TEXT,
  effect_color TEXT,
  effect_intensity TEXT,
  rarity TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.effect_name,
    e.effect_emoji,
    e.cost,
    e.duration_seconds,
    e.effect_animation,
    e.effect_color,
    e.effect_intensity,
    CASE 
      WHEN e.cost <= 1000 THEN 'common'
      WHEN e.cost <= 10000 THEN 'rare'
      WHEN e.cost <= 50000 THEN 'epic'
      ELSE 'legendary'
    END::TEXT as rarity
  FROM entrance_effects e
  WHERE e.user_id = '00000000-0000-0000-0000-000000000000'
  ORDER BY e.cost ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_store_entrance_effects() TO anon, authenticated;