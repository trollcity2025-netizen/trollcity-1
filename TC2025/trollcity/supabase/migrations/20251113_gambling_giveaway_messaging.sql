-- Migration: Add gambling, giveaway, and age verification features
-- Date: 2025-11-13

-- 1. Add age verification columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_age_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMP;

-- 2. Create gambling_records table for tracking bets
CREATE TABLE IF NOT EXISTS gambling_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bet_amount BIGINT NOT NULL,
  result TEXT CHECK (result IN ('win', 'loss')) NOT NULL,
  winnings BIGINT DEFAULT 0,
  multiplier DECIMAL(5,2),
  created_date TIMESTAMP DEFAULT NOW(),
  updated_date TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gambling_user_id ON gambling_records(user_id);
CREATE INDEX IF NOT EXISTS idx_gambling_created_date ON gambling_records(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_gambling_result ON gambling_records(result);

-- 3. Create gambling_stats table for house statistics
CREATE TABLE IF NOT EXISTS gambling_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_wagered BIGINT DEFAULT 0,
  total_paid_out BIGINT DEFAULT 0,
  total_house_profit BIGINT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);

-- 4. Create giveaway_records table for tracking coin giveaways
CREATE TABLE IF NOT EXISTS giveaway_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  giveaway_type TEXT DEFAULT 'random' CHECK (giveaway_type IN ('random', 'promotion', 'manual')),
  created_date TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_giveaway_user_id ON giveaway_records(user_id);
CREATE INDEX IF NOT EXISTS idx_giveaway_created_date ON giveaway_records(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_giveaway_type ON giveaway_records(giveaway_type);

-- 5. Add message settings columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS messages_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS message_cost BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS message_cost_is_paid BOOLEAN DEFAULT false;

-- 6. Create message_payments table for tracking paid messages
CREATE TABLE IF NOT EXISTS message_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  is_paid_coin BOOLEAN DEFAULT true,
  message_id UUID,
  created_date TIMESTAMP DEFAULT NOW(),
  UNIQUE(sender_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_message_payments_sender ON message_payments(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_payments_recipient ON message_payments(recipient_id);
CREATE INDEX IF NOT EXISTS idx_message_payments_created ON message_payments(created_date DESC);

-- 7. Add streaming stats columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS like_count BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS stream_coins_earned BIGINT DEFAULT 0;

-- 8. Create stream_likes table for tracking likes during streams
CREATE TABLE IF NOT EXISTS stream_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stream_id UUID NOT NULL,
  created_date TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_likes_user ON stream_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_likes_stream ON stream_likes(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_likes_created ON stream_likes(created_date DESC);

-- 9. Create entrance_effects table for effect purchases
CREATE TABLE IF NOT EXISTS entrance_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  effect_name TEXT NOT NULL,
  effect_emoji TEXT,
  cost BIGINT NOT NULL,
  duration_seconds INT DEFAULT 4,
  purchased_date TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entrance_effects_user ON entrance_effects(user_id);
CREATE INDEX IF NOT EXISTS idx_entrance_effects_purchased ON entrance_effects(purchased_date DESC);

-- 10. Add ban/kick protection for admins
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS admin_ban_protected BOOLEAN DEFAULT false;

-- Grant necessary permissions (if not already granted)
-- Note: Adjust these based on your specific Supabase setup
GRANT SELECT, INSERT, UPDATE ON gambling_records TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON gambling_stats TO anon, authenticated;
GRANT SELECT, INSERT ON giveaway_records TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON message_payments TO anon, authenticated;
GRANT SELECT, INSERT ON stream_likes TO anon, authenticated;
GRANT SELECT, INSERT ON entrance_effects TO anon, authenticated;
