-- Fix missing reference_id column in coin_transactions table
ALTER TABLE coin_transactions 
ADD COLUMN IF NOT EXISTS reference_id TEXT,
ADD COLUMN IF NOT EXISTS reference_type TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_coin_transactions_reference_id ON coin_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_reference_type ON coin_transactions(reference_type);

-- Grant permissions for the new columns
GRANT UPDATE ON coin_transactions TO authenticated;