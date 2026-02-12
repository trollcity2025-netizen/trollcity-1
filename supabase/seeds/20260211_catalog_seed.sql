-- Catalog seed file (review before running)
-- Purpose: ensure baseline items exist so new users don't hit empty catalogs.

-- Gifts (handle schema drift safely)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gifts' AND column_name = 'icon_url') THEN
    INSERT INTO public.gifts (name, icon_url, cost, animation_type)
    SELECT * FROM (VALUES
      ('Rose', '🌹', 50, 'float_up'),
      ('Sparkle', '✨', 100, 'shine'),
      ('Hype', '🔥', 250, 'explode')
    ) AS v(name, icon_url, cost, animation_type)
    WHERE NOT EXISTS (SELECT 1 FROM public.gifts);
  ELSE
    INSERT INTO public.gifts (name, icon, coin_cost, animation_type, is_active)
    SELECT * FROM (VALUES
      ('Rose', '🌹', 50, 'float_up', true),
      ('Sparkle', '✨', 100, 'shine', true),
      ('Hype', '🔥', 250, 'explode', true)
    ) AS v(name, icon, coin_cost, animation_type, is_active)
    WHERE NOT EXISTS (SELECT 1 FROM public.gifts);
  END IF;
END $$;

-- Shop items
INSERT INTO public.shop_items (name, description, price_coins)
SELECT * FROM (VALUES
  ('Starter Pack', 'Starter bundle', 250),
  ('Glow Badge', 'Cosmetic badge', 500),
  ('VIP Shoutout', 'Profile shoutout', 1000)
) AS v(name, description, price_coins)
WHERE NOT EXISTS (SELECT 1 FROM public.shop_items);

-- Insurance options
INSERT INTO public.insurance_options (id, name, cost, description, duration_hours, protection_type, icon, is_active)
SELECT * FROM (VALUES
  ('basic', 'Basic', 200, 'Basic coverage', 168, 'kick', '🛡️', true),
  ('standard', 'Standard', 500, 'Standard coverage', 720, 'bankrupt', '🧯', true),
  ('premium', 'Premium', 1200, 'Premium coverage', 2160, 'full', '💎', true)
) AS v(id, name, cost, description, duration_hours, protection_type, icon, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.insurance_options);

-- Vehicles catalog (only seed if empty)
INSERT INTO public.vehicles_catalog (name, slug, model_url, price, category, image)
SELECT * FROM (VALUES
  ('Compact', 'compact', '', 5000, 'Car', ''),
  ('Sedan', 'sedan', '', 12000, 'Car', ''),
  ('SUV', 'suv', '', 20000, 'Car', '')
) AS v(name, slug, model_url, price, category, image)
WHERE NOT EXISTS (SELECT 1 FROM public.vehicles_catalog);

-- Purchasable items
INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_active, metadata)
SELECT * FROM (VALUES
  ('starter_perk', 'Starter Perk', 'perk', 300, true, '{}'::jsonb),
  ('boost', 'Boost', 'perk', 700, true, '{}'::jsonb)
) AS v(item_key, display_name, category, coin_price, is_active, metadata)
WHERE NOT EXISTS (SELECT 1 FROM public.purchasable_items);

-- Entrance effects
INSERT INTO public.entrance_effects (id, name, icon, coin_cost, rarity, description, animation_type, sound_effect, duration_seconds, image_url, is_active)
SELECT * FROM (VALUES
  ('neon_pop', 'Neon Pop', '✨', 300, 'rare', 'Neon burst entrance', 'pop', 'pop', 5, '', true),
  ('smoke_trail', 'Smoke Trail', '💨', 600, 'epic', 'Smoke trail entrance', 'trail', 'whoosh', 6, '', true)
) AS v(id, name, icon, coin_cost, rarity, description, animation_type, sound_effect, duration_seconds, image_url, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.entrance_effects);

-- Call sounds
INSERT INTO public.call_sound_catalog (slug, name, sound_type, asset_url, price_coins, is_active)
SELECT * FROM (VALUES
  ('airhorn', 'Airhorn', 'call', '', 200, true),
  ('clap', 'Clap', 'call', '', 250, true)
) AS v(slug, name, sound_type, asset_url, price_coins, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.call_sound_catalog);

-- Broadcast themes
INSERT INTO public.broadcast_themes (name, preview_url, is_premium, cost_coins)
SELECT * FROM (VALUES
  ('Classic', '', false, 0),
  ('Midnight', '', true, 800)
) AS v(name, preview_url, is_premium, cost_coins)
WHERE NOT EXISTS (SELECT 1 FROM public.broadcast_themes);

-- Perks
INSERT INTO public.perks (id, name, cost, description, duration_minutes, icon, perk_type, is_active)
SELECT * FROM (VALUES
  ('perk_boost_xp', 'Boost XP', 500, 'Double XP for 1 hour', 60, '⚡', 'boost', true),
  ('perk_priority_queue', 'Priority Queue', 1000, 'Priority access for 24 hours', 1440, '🚀', 'visibility', true)
) AS v(id, name, cost, description, duration_minutes, icon, perk_type, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.perks);
