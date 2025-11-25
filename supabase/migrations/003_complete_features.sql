-- Create additional tables for complete Troll City functionality

-- Create gifts table for the gift system
CREATE TABLE gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  coin_cost INTEGER NOT NULL CHECK (coin_cost > 0),
  animation_type TEXT NOT NULL DEFAULT 'default',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create entrance_effects table
CREATE TABLE entrance_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  coin_cost INTEGER NOT NULL CHECK (coin_cost > 0),
  animation_type TEXT NOT NULL,
  message_template TEXT NOT NULL DEFAULT '{username} has entered Troll City!',
  duration_seconds INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_entrance_effects table (pivot table)
CREATE TABLE user_entrance_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  effect_id UUID NOT NULL REFERENCES entrance_effects(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, effect_id)
);

-- Create payout_requests table for cashouts
CREATE TABLE payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  coins_used INTEGER NOT NULL CHECK (coins_used > 0),
  cash_amount DECIMAL(10,2) NOT NULL CHECK (cash_amount > 0),
  currency TEXT DEFAULT 'USD',
  processing_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  payment_method TEXT,
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Create admin_adjustments table for manual coin adjustments
CREATE TABLE admin_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('paid_coins', 'free_coins')),
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create config table for dynamic settings
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_bans table for ban management
CREATE TABLE user_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  banned_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  ban_type TEXT NOT NULL CHECK (ban_type IN ('temporary', 'permanent')),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stream_reports table for content moderation
CREATE TABLE stream_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default gifts
INSERT INTO gifts (name, icon, coin_cost, animation_type, description) VALUES
('Troll Face', '😈', 10, 'bounce', 'Classic troll face'),
('Fire', '🔥', 50, 'pulse', 'Set the stream on fire!'),
('Crown', '👑', 100, 'spin', 'Crown the broadcaster'),
('Money', '💰', 500, 'rain', 'Make it rain coins'),
('Diamond', '💎', 1000, 'glow', 'Ultimate gift'),
('Bomb', '💣', 200, 'shake', 'Explosive entrance'),
('Lightning', '⚡', 75, 'flash', 'Light up the stream');

-- Insert default entrance effects
INSERT INTO entrance_effects (name, icon, coin_cost, animation_type, message_template, duration_seconds) VALUES
('Royal Entry', '👑', 100, 'royal', '👑 {username} has entered Troll City!', 3),
('Fire Walker', '🔥', 75, 'fire', '🔥 {username} walks through flames!', 2),
('Lightning Strike', '⚡', 50, 'lightning', '⚡ {username} appears in a flash!', 2),
('Money Rain', '💰', 200, 'money', '💰 {username} arrives with golden style!', 4),
('Mystic Portal', '🌀', 150, 'portal', '🌀 {username} emerges from the void!', 3);

-- Insert default config values
INSERT INTO config (key, value, description, category, is_public) VALUES
('troll_wheel_spin_cost', '50', 'Cost in paid coins to spin the Troll Wheel', 'wheel', true),
('bankrupt_percentage', '50', 'Percentage of paid coins lost on Bankrupt', 'wheel', true),
('welcome_bonus_coins', '100', 'Free coins given to new users', 'general', true),
('daily_login_bonus', '10', 'Free coins for daily login', 'general', true),
('stream_title_min_length', '5', 'Minimum length for stream titles', 'streaming', true),
('stream_title_max_length', '100', 'Maximum length for stream titles', 'streaming', true),
('max_gift_message_length', '200', 'Maximum length for gift messages', 'gifts', true),
('entrance_effect_duration', '3', 'Default duration for entrance effects in seconds', 'effects', true);

ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrance_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_entrance_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_reports ENABLE ROW LEVEL SECURITY;

--
-- Gifts policies
CREATE POLICY "Anyone can view active gifts" ON gifts FOR SELECT USING (is_active = true);

-- Entrance effects policies
CREATE POLICY "Anyone can view active effects" ON entrance_effects FOR SELECT USING (is_active = true);
CREATE POLICY "Users can view own effects" ON user_entrance_effects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own effects" ON user_entrance_effects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own effects" ON user_entrance_effects FOR UPDATE USING (auth.uid() = user_id);

-- Payout requests policies
CREATE POLICY "Users can view own payout requests" ON payout_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create payout requests" ON payout_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all payout requests" ON payout_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update payout requests" ON payout_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Admin adjustments policies
CREATE POLICY "Only admins can create adjustments" ON admin_adjustments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can view all adjustments" ON admin_adjustments FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can view adjustments to their account" ON admin_adjustments FOR SELECT USING (auth.uid() = target_user_id);

-- Config policies
CREATE POLICY "Anyone can view public config" ON config FOR SELECT USING (is_public = true);
CREATE POLICY "Admins can view all config" ON config FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update config" ON config FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- User bans policies
CREATE POLICY "Users can view own bans" ON user_bans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all bans" ON user_bans FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);
CREATE POLICY "Admins can create bans" ON user_bans FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);
CREATE POLICY "Admins can update bans" ON user_bans FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

-- Stream reports policies
CREATE POLICY "Users can create reports" ON stream_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Anyone can view reports on public streams" ON stream_reports FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM streams 
    WHERE streams.id = stream_reports.stream_id 
    AND streams.status = 'live'
  )
);
CREATE POLICY "Admins can view all reports" ON stream_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);
CREATE POLICY "Admins can update reports" ON stream_reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);