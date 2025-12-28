-- Add admin_grant transaction type to coin_transactions
-- Allows admins to grant coins without payment processing

-- Update coin_transactions type constraint to include 'admin_grant'
ALTER TABLE coin_transactions 
  DROP CONSTRAINT IF EXISTS coin_transactions_type_check;

-- Add admin_grant to allowed types
ALTER TABLE coin_transactions
  ADD CONSTRAINT coin_transactions_type_check 
  CHECK (type IN (
    'purchase',
    'gift',
    'spin',
    'insurance',
    'cashout',
    'admin_grant',
    'store_purchase',
    'perk_purchase',
    'gift_send',
    'gift_receive',
    'kick_fee',
    'ban_fee',
    'wheel_spin',
    'insurance_purchase'
  ));

-- Add comment
COMMENT ON COLUMN coin_transactions.type IS 'Transaction type: purchase, gift, spin, cashout, admin_grant (admin-only free coins), etc';

-- Create index for admin grants (for auditing)
CREATE INDEX IF NOT EXISTS idx_coin_transactions_admin_grant 
  ON coin_transactions(type, created_at) 
  WHERE type = 'admin_grant';

COMMENT ON INDEX idx_coin_transactions_admin_grant IS 'Index for tracking admin coin grants';

