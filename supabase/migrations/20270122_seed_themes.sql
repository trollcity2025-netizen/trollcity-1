-- Seed Broadcast Themes
-- Only inserts if they don't exist

INSERT INTO public.broadcast_background_themes (id, name, description, price_coins, is_premium, image_url, css_class)
VALUES 
  ('purple', 'Royal Purple', 'The classic Troll City look.', 0, false, '/assets/themes/theme_purple.svg', 'theme-purple'),
  ('neon', 'Cyber Neon', 'High contrast neon styling.', 100, false, '/assets/themes/theme_neon.svg', 'theme-neon'),
  ('rgb', 'Gamer RGB', 'Animated RGB flow for true gamers.', 500, true, '/assets/themes/theme_rgb.svg', 'theme-rgb')
ON CONFLICT (id) DO UPDATE 
SET 
  image_url = EXCLUDED.image_url,
  css_class = EXCLUDED.css_class;
