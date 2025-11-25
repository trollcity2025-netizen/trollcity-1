-- Create user_profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT DEFAULT 'New troll in the city!',
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  tier TEXT DEFAULT 'Bronze' CHECK (tier IN ('Bronze', 'Silver', 'Gold', 'Platinum')),
  paid_coin_balance INTEGER DEFAULT 0 CHECK (paid_coin_balance >= 0),
  free_coin_balance INTEGER DEFAULT 0 CHECK (free_coin_balance >= 0),
  total_earned_coins INTEGER DEFAULT 0,
  total_spent_coins INTEGER DEFAULT 0,
  insurance_level TEXT,
  insurance_expires_at TIMESTAMP WITH TIME ZONE,
  no_kick_until TIMESTAMP WITH TIME ZONE,
  no_ban_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create streams table
CREATE TABLE streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'Gaming',
  status TEXT DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  current_viewers INTEGER DEFAULT 0 CHECK (current_viewers >= 0),
  total_gifts_coins INTEGER DEFAULT 0 CHECK (total_gifts_coins >= 0),
  total_unique_gifters INTEGER DEFAULT 0,
  agora_channel TEXT NOT NULL,
  agora_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table for chat
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'gift', 'entrance')),
  gift_amount INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create coin_transactions table
CREATE TABLE coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'gift', 'spin', 'insurance', 'cashout')),
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create coin_packages table
CREATE TABLE coin_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  coin_amount INTEGER NOT NULL CHECK (coin_amount > 0),
  price DECIMAL(10,2) NOT NULL CHECK (price > 0),
  currency TEXT DEFAULT 'USD',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wheel_slices table
CREATE TABLE wheel_slices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('coins', 'bankrupt', 'perk')),
  value INTEGER,
  perk_type TEXT CHECK (perk_type IN ('no_kick', 'no_ban')),
  probability DECIMAL(5,4) NOT NULL CHECK (probability > 0 AND probability <= 1),
  color TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create insurance_packages table
CREATE TABLE insurance_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  level TEXT NOT NULL,
  cost INTEGER NOT NULL CHECK (cost > 0),
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  benefits TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cashout_tiers table
CREATE TABLE cashout_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_amount INTEGER NOT NULL CHECK (coin_amount > 0),
  cash_amount DECIMAL(10,2) NOT NULL CHECK (cash_amount > 0),
  currency TEXT DEFAULT 'USD',
  processing_fee_percentage DECIMAL(5,2) DEFAULT 5.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_streams_broadcaster_id ON streams(broadcaster_id);
CREATE INDEX idx_streams_status ON streams(status);
CREATE INDEX idx_streams_start_time ON streams(start_time);
CREATE INDEX idx_messages_stream_id ON messages(stream_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_coin_transactions_user_id ON coin_transactions(user_id);
CREATE INDEX idx_coin_transactions_created_at ON coin_transactions(created_at);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wheel_slices ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashout_tiers ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view all profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Streams policies
CREATE POLICY "Anyone can view live streams" ON streams FOR SELECT USING (status = 'live');
CREATE POLICY "Broadcasters can view own streams" ON streams FOR SELECT USING (broadcaster_id = auth.uid());
CREATE POLICY "Broadcasters can insert streams" ON streams FOR INSERT WITH CHECK (broadcaster_id = auth.uid());
CREATE POLICY "Broadcasters can update own streams" ON streams FOR UPDATE USING (broadcaster_id = auth.uid());

-- Messages policies
CREATE POLICY "Anyone can view stream messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Users can insert messages" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Coin transactions policies
CREATE POLICY "Users can view own transactions" ON coin_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON coin_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Coin packages policies
CREATE POLICY "Anyone can view active packages" ON coin_packages FOR SELECT USING (is_active = true);

-- Wheel slices policies
CREATE POLICY "Anyone can view active slices" ON wheel_slices FOR SELECT USING (is_active = true);

-- Insurance packages policies
CREATE POLICY "Anyone can view active packages" ON insurance_packages FOR SELECT USING (is_active = true);

-- Cashout tiers policies
CREATE POLICY "Anyone can view active tiers" ON cashout_tiers FOR SELECT USING (is_active = true);