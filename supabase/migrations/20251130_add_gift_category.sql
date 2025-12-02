-- Add category column to gift_items table
ALTER TABLE gift_items 
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Common' 
  CHECK (category IN ('Common', 'Premium', 'Limited', 'Legendary', 'Seasonal', 'Mystery'));

-- Update existing gifts with default category
UPDATE gift_items SET category = 'Common' WHERE category IS NULL;

-- Insert new gift items with categories
INSERT INTO gift_items (name, icon, value, category) VALUES
  ('Sav', '🌸', 250, 'Common'),
  ('Vived', '💎', 600, 'Premium'),
  ('Rose', '🌹', 120, 'Common'),
  ('Golden Maple Leaf', '🌿💛', 420, 'Premium'),
  ('Fireworks', '🎆', 550, 'Premium'),
  ('Mini Troll Bomb', '👹', 666, 'Limited'),
  ('Royal Crown', '👑', 1500, 'Legendary'),
  ('Chaos Gift', '💥', 999, 'Limited'),
  ('Heart Rain', '💘', 300, 'Seasonal'),
  ('Surprise Gift Box', '🎁', 777, 'Mystery')
ON CONFLICT DO NOTHING;

