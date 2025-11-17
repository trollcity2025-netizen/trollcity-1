-- Fix payment method columns in profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS apple_pay_id TEXT,
ADD COLUMN IF NOT EXISTS google_wallet_id TEXT,
ADD COLUMN IF NOT EXISTS chime_id TEXT,
ADD COLUMN IF NOT EXISTS cashapp_id TEXT,
ADD COLUMN IF NOT EXISTS message_charge_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS message_charge_enabled BOOLEAN DEFAULT FALSE;

-- Grant permissions for the new columns
GRANT SELECT (apple_pay_id, google_wallet_id, chime_id, cashapp_id, message_charge_amount, message_charge_enabled) ON profiles TO anon;
GRANT UPDATE (apple_pay_id, google_wallet_id, chime_id, cashapp_id, message_charge_amount, message_charge_enabled) ON profiles TO authenticated;