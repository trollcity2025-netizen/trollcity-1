-- Purchase Activation System Database Schema
-- This file creates the core tables for tracking purchases and enabling item activation

-- 1. Main purchases tracking table
CREATE TABLE IF NOT EXISTS user_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL,
  item_id VARCHAR(255) NOT NULL,
  item_name VARCHAR(255),
  purchase_price INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT false,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_purchases_user_id ON user_purchases(user_id);
CREATE INDEX idx_user_purchases_item_type ON user_purchases(item_type);
CREATE INDEX idx_user_purchases_is_active ON user_purchases(is_active);
CREATE INDEX idx_user_purchases_expires_at ON user_purchases(expires_at);

-- 2. Track which item is currently active per category
CREATE TABLE IF NOT EXISTS user_active_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_category VARCHAR(50) NOT NULL,
  item_id VARCHAR(255) NOT NULL,
  activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, item_category)
);

CREATE INDEX idx_user_active_items_user_id ON user_active_items(user_id);

-- 3. Avatar customization system
CREATE TABLE IF NOT EXISTS user_avatar_customization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  head_item_id VARCHAR(50),
  face_item_id VARCHAR(50),
  body_item_id VARCHAR(50),
  legs_item_id VARCHAR(50),
  feet_item_id VARCHAR(50),
  accessories_ids TEXT[],
  skin_tone VARCHAR(50),
  hair_color VARCHAR(50),
  beard_style VARCHAR(50),
  avatar_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE INDEX idx_user_avatar_customization_user_id ON user_avatar_customization(user_id);

-- 4. Troll Mart clothing items catalog
CREATE TABLE IF NOT EXISTS troll_mart_clothing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  item_code VARCHAR(50) UNIQUE NOT NULL,
  price_coins INTEGER NOT NULL,
  image_url TEXT,
  model_url TEXT,
  description TEXT,
  rarity VARCHAR(50) DEFAULT 'common',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_troll_mart_clothing_category ON troll_mart_clothing(category);
CREATE INDEX idx_troll_mart_clothing_is_active ON troll_mart_clothing(is_active);

-- 5. Track user's owned Troll Mart items
CREATE TABLE IF NOT EXISTS user_troll_mart_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clothing_id UUID NOT NULL REFERENCES troll_mart_clothing(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, clothing_id)
);

CREATE INDEX idx_user_troll_mart_purchases_user_id ON user_troll_mart_purchases(user_id);

-- Enable RLS on all tables
ALTER TABLE user_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_active_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_avatar_customization ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_mart_clothing ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_troll_mart_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_purchases
CREATE POLICY "users_can_view_own_purchases" ON user_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_purchases" ON user_purchases
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for user_active_items
CREATE POLICY "users_can_manage_own_active_items" ON user_active_items
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for user_avatar_customization
CREATE POLICY "users_can_manage_own_avatar" ON user_avatar_customization
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for troll_mart_clothing (public read, admin write)
CREATE POLICY "public_can_view_clothing" ON troll_mart_clothing
  FOR SELECT USING (true);

-- RLS Policies for user_troll_mart_purchases
CREATE POLICY "users_can_manage_own_troll_mart" ON user_troll_mart_purchases
  FOR ALL USING (auth.uid() = user_id);

-- Initial Troll Mart Seed Data
INSERT INTO troll_mart_clothing (name, category, item_code, price_coins, description, rarity, sort_order) VALUES
-- Heads
('Classic Human', 'head', 'head_classic', 0, 'Default classic human head', 'common', 1),
('Round Face', 'head', 'head_round', 500, 'Softer rounded face shape', 'common', 2),
('Square Jaw', 'head', 'head_square', 500, 'Masculine square face', 'common', 3),
('Alien', 'head', 'head_alien', 2000, 'Futuristic alien head', 'rare', 4),
('Monster', 'head', 'head_monster', 3000, 'Scary monster face', 'rare', 5),
('Celestial', 'head', 'head_celestial', 5000, 'Glowing celestial being', 'epic', 6),

-- Bodies
('White T-Shirt', 'body', 'body_tshirt_white', 500, 'Classic white cotton t-shirt', 'common', 1),
('Black T-Shirt', 'body', 'body_tshirt_black', 500, 'Classic black cotton t-shirt', 'common', 2),
('Leather Jacket', 'body', 'body_jacket_leather', 3000, 'Cool black leather jacket', 'rare', 3),
('Business Suit', 'body', 'body_suit_formal', 5000, 'Formal business suit', 'rare', 4),
('Tuxedo', 'body', 'body_tuxedo', 8000, 'Elegant black tuxedo', 'epic', 5),
('Armor', 'body', 'body_armor_knight', 10000, 'Medieval knight armor', 'epic', 6),

-- Legs
('Blue Jeans', 'legs', 'legs_jeans_blue', 500, 'Classic blue denim jeans', 'common', 1),
('Black Jeans', 'legs', 'legs_jeans_black', 500, 'Classic black denim jeans', 'common', 2),
('Shorts', 'legs', 'legs_shorts', 300, 'Casual shorts', 'common', 3),
('Dress Pants', 'legs', 'legs_pants_formal', 1500, 'Formal dress pants', 'rare', 4),
('Leather Pants', 'legs', 'legs_pants_leather', 3000, 'Cool leather pants', 'rare', 5),

-- Feet
('Sneakers', 'feet', 'feet_sneakers', 500, 'Classic white sneakers', 'common', 1),
('Black Shoes', 'feet', 'feet_shoes_dress', 1000, 'Formal dress shoes', 'common', 2),
('Boots', 'feet', 'feet_boots', 2000, 'Heavy duty boots', 'rare', 3),
('Heels', 'feet', 'feet_heels', 1500, 'Stylish heels', 'rare', 4),
('Sandals', 'feet', 'feet_sandals', 300, 'Casual sandals', 'common', 5),

-- Accessories
('Sunglasses', 'accessories', 'acc_sunglasses', 1000, 'Cool dark sunglasses', 'common', 1),
('Gold Chain', 'accessories', 'acc_chain_gold', 2000, 'Shiny gold chain necklace', 'rare', 2),
('Crown', 'accessories', 'acc_crown', 5000, 'Royal gold crown', 'epic', 3),
('Top Hat', 'accessories', 'acc_hat_top', 3000, 'Fancy top hat', 'rare', 4),
('Cowboy Hat', 'accessories', 'acc_hat_cowboy', 2500, 'Wild west cowboy hat', 'rare', 5),
('Beanie', 'accessories', 'acc_beanie', 800, 'Cozy winter beanie', 'common', 6),
('Pipe', 'accessories', 'acc_pipe', 1500, 'Smoking pipe', 'common', 7),
('Watch', 'accessories', 'acc_watch', 4000, 'Luxury gold watch', 'epic', 8);

-- Verify tables created successfully
SELECT 'Purchase system tables created successfully' as status;
