-- Fix missing columns in payouts and payout_requests tables
-- This ensures that if previous migrations failed or skipped, we still have the correct schema.

DO $$
BEGIN
  -- 1. Ensure payouts columns
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payouts') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payouts' AND column_name = 'run_id') THEN
      ALTER TABLE payouts ADD COLUMN run_id UUID REFERENCES payout_runs(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payouts' AND column_name = 'tier_id') THEN
      ALTER TABLE payouts ADD COLUMN tier_id TEXT REFERENCES payout_tiers(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payouts' AND column_name = 'paypal_batch_id') THEN
      ALTER TABLE payouts ADD COLUMN paypal_batch_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payouts' AND column_name = 'paypal_payout_item_id') THEN
      ALTER TABLE payouts ADD COLUMN paypal_payout_item_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payouts' AND column_name = 'processed_at') THEN
      ALTER TABLE payouts ADD COLUMN processed_at TIMESTAMPTZ;
    END IF;
  END IF;

  -- 2. Ensure payout_requests columns
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_requests') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payout_requests' AND column_name = 'processed_at') THEN
      ALTER TABLE payout_requests ADD COLUMN processed_at TIMESTAMPTZ;
    END IF;
  END IF;
END $$;
