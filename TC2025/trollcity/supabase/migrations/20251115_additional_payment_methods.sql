-- Add new payment method fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS apple_pay_id TEXT,
ADD COLUMN IF NOT EXISTS google_wallet_id TEXT,
ADD COLUMN IF NOT EXISTS chime_id TEXT,
ADD COLUMN IF NOT EXISTS message_charge_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS message_charge_enabled BOOLEAN DEFAULT FALSE;

-- Create tables for new payout methods
CREATE TABLE IF NOT EXISTS apple_pay_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  payout_id UUID REFERENCES payouts(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  apple_pay_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS google_wallet_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  payout_id UUID REFERENCES payouts(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  google_wallet_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chime_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  payout_id UUID REFERENCES payouts(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  chime_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_apple_pay_payouts_user_id ON apple_pay_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_apple_pay_payouts_payout_id ON apple_pay_payouts(payout_id);
CREATE INDEX IF NOT EXISTS idx_google_wallet_payouts_user_id ON google_wallet_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_google_wallet_payouts_payout_id ON google_wallet_payouts(payout_id);
CREATE INDEX IF NOT EXISTS idx_chime_payouts_user_id ON chime_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_chime_payouts_payout_id ON chime_payouts(payout_id);

-- Grant permissions for new tables
GRANT ALL PRIVILEGES ON apple_pay_payouts TO authenticated;
GRANT ALL PRIVILEGES ON google_wallet_payouts TO authenticated;
GRANT ALL PRIVILEGES ON chime_payouts TO authenticated;
GRANT SELECT ON apple_pay_payouts TO anon;
GRANT SELECT ON google_wallet_payouts TO anon;
GRANT SELECT ON chime_payouts TO anon;