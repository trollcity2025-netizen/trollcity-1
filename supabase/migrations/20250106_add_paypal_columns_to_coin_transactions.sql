-- Add missing columns for PayPal transactions
DO $$ 
BEGIN
  -- Add external_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coin_transactions' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE coin_transactions ADD COLUMN external_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_coin_transactions_external_id ON coin_transactions(external_id);
  END IF;
  
  -- Add payment_status if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coin_transactions' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE coin_transactions ADD COLUMN payment_status TEXT;
  END IF;
END $$;

