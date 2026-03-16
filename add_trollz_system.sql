-- Trollz Wheel System Database Migration
-- Adds trollz_balance and bonus_coin_balance columns to user_profiles

-- Add trollz_balance column (free engagement currency)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS trollz_balance INTEGER DEFAULT 0 NOT NULL;

-- Add bonus_coin_balance column (bonus coins from wheel/conversion - not cashout eligible)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS bonus_coin_balance INTEGER DEFAULT 0 NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_trollz_balance ON user_profiles(trollz_balance);
CREATE INDEX IF NOT EXISTS idx_user_profiles_bonus_coin_balance ON user_profiles(bonus_coin_balance);

-- Create trollz_transactions table for audit trail
CREATE TABLE IF NOT EXISTS trollz_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trollz_transactions_user_id ON trollz_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_trollz_transactions_created_at ON trollz_transactions(created_at);

-- Create bonus_coin_transactions table for audit trail
CREATE TABLE IF NOT EXISTS bonus_coin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount INTEGER NOT NULL,
    source VARCHAR(50) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bonus_coin_transactions_user_id ON bonus_coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bonus_coin_transactions_created_at ON bonus_coin_transactions(created_at);

-- Create troll_wheel_wins table for tracking wheel usage
CREATE TABLE IF NOT EXISTS troll_wheel_wins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    cost_trollz INTEGER NOT NULL,
    reward_type VARCHAR(50) NOT NULL,
    reward_amount INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_troll_wheel_wins_user_id ON troll_wheel_wins(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_wheel_wins_created_at ON troll_wheel_wins(created_at);

-- Enable RLS
ALTER TABLE trollz_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_wheel_wins ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own trollz transactions" 
ON trollz_transactions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trollz transactions" 
ON trollz_transactions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own bonus coin transactions" 
ON bonus_coin_transactions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bonus coin transactions" 
ON bonus_coin_transactions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own wheel wins" 
ON troll_wheel_wins FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wheel wins" 
ON troll_wheel_wins FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Update user_profiles view to include new columns
COMMENT ON COLUMN user_profiles.trollz_balance IS 'Free engagement currency earned from gifting';
COMMENT ON COLUMN user_profiles.bonus_coin_balance IS 'Bonus coins from wheel/conversion (not eligible for cashout)';
