-- Create gift_items table for holiday-themed gifts
CREATE TABLE IF NOT EXISTS gift_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL,
  value integer NOT NULL CHECK (value > 0),
  category text DEFAULT 'Common' CHECK (category IN ('Common', 'Premium', 'Limited', 'Legendary', 'Seasonal', 'Mystery')),
  holiday_theme text DEFAULT NULL,
  description text,
  animation_type text DEFAULT 'standard',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for holiday theme queries
CREATE INDEX IF NOT EXISTS idx_gift_items_holiday_theme ON gift_items(holiday_theme);
CREATE INDEX IF NOT EXISTS idx_gift_items_value ON gift_items(value);

-- Insert gift items with categories
INSERT INTO gift_items (name, icon, value, category, holiday_theme, description, animation_type) VALUES
  -- Core gifts with categories
  ('Sav', '🌸', 250, 'Common', NULL, 'Beautiful sav flower', 'float'),
  ('Vived', '💎', 600, 'Premium', NULL, 'Premium diamond gift', 'sparkle'),
  ('Rose', '🌹', 120, 'Common', NULL, 'A beautiful rose', 'fallingPetals'),
  ('Golden Maple Leaf', '🌿💛', 420, 'Premium', NULL, 'Golden maple leaf', 'float'),
  ('Fireworks', '🎆', 550, 'Premium', NULL, 'Celebrate with fireworks', 'fireworks'),
  ('Mini Troll Bomb', '👹', 666, 'Limited', NULL, 'Chaos unleashed', 'explosion'),
  ('Royal Crown', '👑', 1500, 'Legendary', NULL, 'Royal crown gift', 'sparkle'),
  ('Chaos Gift', '💥', 999, 'Limited', NULL, 'Pure chaos', 'explosion'),
  ('Heart Rain', '💘', 300, 'Seasonal', NULL, 'Hearts raining down', 'float'),
  ('Surprise Gift Box', '🎁', 777, 'Mystery', NULL, 'Mystery gift box', 'pop'),
  
  -- Holiday gifts
  ('Christmas Tree', '🎄', 150, 'Seasonal', 'Christmas', 'A festive Christmas tree gift', 'sparkle'),
  ('Santa Gift', '🎅', 200, 'Premium', 'Christmas', 'A special gift from Santa', 'explosion'),
  ('Snowflake', '❄️', 100, 'Common', 'Christmas', 'A beautiful snowflake', 'float'),
  ('Fireworks Pack', '🎆', 180, 'Premium', 'New Year', 'Celebrate with fireworks', 'fireworks'),
  ('Champagne', '🍾', 220, 'Premium', 'New Year', 'Pop the champagne!', 'sparkle'),
  ('Party Popper', '🎉', 120, 'Common', 'New Year', 'Party time!', 'pop'),
  ('Rose Bouquet', '🌹', 120, 'Common', 'Valentine', 'A beautiful bouquet of roses', 'fallingPetals'),
  ('Heart Box', '💝', 150, 'Premium', 'Valentine', 'A gift from the heart', 'sparkle'),
  ('Chocolate Box', '🍫', 100, 'Common', 'Valentine', 'Sweet chocolates', 'bounce'),
  ('Pumpkin Bomb', '🎃', 140, 'Limited', 'Halloween', 'A spooky pumpkin', 'explosion'),
  ('Ghost', '👻', 110, 'Common', 'Halloween', 'Boo!', 'float'),
  ('Witch Hat', '🧙', 160, 'Premium', 'Halloween', 'A magical witch hat', 'sparkle'),
  
  -- Regular gifts (no holiday theme)
  ('Troll Respect', '👍', 5, 'Common', NULL, 'Show some respect', 'bounce'),
  ('Neon Heart', '💜', 10, 'Common', NULL, 'Send love', 'pulse'),
  ('Candy Troll Pop', '🍭', 15, 'Common', NULL, 'Sweet treat', 'spin')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE gift_items ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read gift items
CREATE POLICY "Anyone can view gift items"
  ON gift_items FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to read gift items (anon for public viewing)
CREATE POLICY "Public can view gift items"
  ON gift_items FOR SELECT
  TO anon
  USING (true);

-- Add comment
COMMENT ON TABLE gift_items IS 'Holiday-themed and regular gift items for the gift system';
COMMENT ON COLUMN gift_items.holiday_theme IS 'Holiday theme name (Christmas, New Year, Valentine, Halloween) or NULL for regular gifts';

