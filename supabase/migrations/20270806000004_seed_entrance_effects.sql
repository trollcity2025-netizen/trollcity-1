-- Ensure entrance_effects has a category column and seed it with effects
-- This fixes the issue where filtering by category might hide everything if data is missing

-- 1. Add category column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entrance_effects' AND column_name = 'category') THEN
        ALTER TABLE public.entrance_effects ADD COLUMN category TEXT DEFAULT 'entrance_effect';
    END IF;
END $$;

-- 2. Seed entrance effects
INSERT INTO public.entrance_effects (id, name, coin_cost, rarity, description, category, is_active, icon)
VALUES
('effect_troll_classic', 'Troll Classic', 100, 'Common', 'The classic Troll City entrance.', 'entrance_effect', true, '👺'),
('effect_royal_sparkle_crown', 'Royal Sparkle Crown', 500, 'Rare', 'Enter with a sparkling crown.', 'entrance_effect', true, '👑'),
('effect_neon_meteor_shower', 'Neon Meteor Shower', 1000, 'Epic', 'A shower of neon meteors.', 'entrance_effect', true, '☄️'),
('effect_lightning_strike_arrival', 'Lightning Strike', 1500, 'Epic', 'Strike the ground with lightning.', 'entrance_effect', true, '⚡'),
('effect_chaos_portal_arrival', 'Chaos Portal', 2000, 'Legendary', 'Emerge from a chaotic portal.', 'entrance_effect', true, '🌀'),
('effect_galactic_warp_beam', 'Galactic Warp', 2500, 'Legendary', 'Beam down from the galaxy.', 'entrance_effect', true, '🌌'),
('effect_troll_city_vip_flames', 'VIP Flames', 3000, 'Legendary', 'Surrounded by VIP flames.', 'entrance_effect', true, '🔥'),
('effect_flaming_gold_crown_drop', 'Flaming Gold Crown', 3500, 'Legendary', 'A flaming gold crown drops.', 'entrance_effect', true, '👸'),
('effect_aurora_storm_entrance', 'Aurora Storm', 4000, 'Legendary', 'An aurora storm surrounds you.', 'entrance_effect', true, '🌈'),
('effect_black_hole_vortex', 'Black Hole Vortex', 5000, 'Mythic', 'Sucked in by a black hole.', 'entrance_effect', true, '⚫'),
('effect_money_shower_madness', 'Money Shower', 5500, 'Mythic', 'Raining money everywhere.', 'entrance_effect', true, '💸'),
('effect_floating_royal_throne', 'Royal Throne', 6000, 'Mythic', 'Float in on a royal throne.', 'entrance_effect', true, '🪑'),
('effect_platinum_fire_tornado', 'Platinum Fire Tornado', 7000, 'Mythic', 'A tornado of platinum fire.', 'entrance_effect', true, '🌪️'),
('effect_cosmic_crown_meteor_fall', 'Cosmic Crown Meteor', 8000, 'Mythic', 'A cosmic crown meteor falls.', 'entrance_effect', true, '🌠'),
('effect_royal_diamond_explosion', 'Diamond Explosion', 9000, 'Mythic', 'Explode into diamonds.', 'entrance_effect', true, '💎'),
('effect_neon_chaos_warp', 'Neon Chaos Warp', 10000, 'God', 'Warp reality with neon chaos.', 'entrance_effect', true, '✨'),
('effect_supreme_emerald_storm', 'Supreme Emerald Storm', 12000, 'God', 'A storm of emeralds.', 'entrance_effect', true, '💚'),
('effect_millionaire_troller_arrival', 'Millionaire Troller', 15000, 'God', 'The arrival of a millionaire.', 'entrance_effect', true, '🤑'),
('effect_troll_god_ascension', 'Troll God Ascension', 20000, 'God', 'Ascend as a Troll God.', 'entrance_effect', true, '🛐'),
('effect_troll_city_world_domination', 'World Domination', 50000, 'God', 'Dominate the world.', 'entrance_effect', true, '🌍')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    coin_cost = EXCLUDED.coin_cost,
    rarity = EXCLUDED.rarity,
    description = EXCLUDED.description,
    category = 'entrance_effect', -- Force category to be entrance_effect
    is_active = EXCLUDED.is_active,
    icon = EXCLUDED.icon;

-- 3. Update any existing rows that might be missing the category
UPDATE public.entrance_effects SET category = 'entrance_effect' WHERE category IS NULL OR category = '';

-- 4. Ensure purchasable_items also has these (if they are mirrored there)
-- Note: If entrance_effects is independent, this step is optional but good for consistency if items are bought via purchasable_items table.
-- Checking if purchasable_items has a 'type' or 'category' column to match.
