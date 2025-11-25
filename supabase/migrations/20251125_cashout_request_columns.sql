-- Add explicit fee/result columns to cashout_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='cashout_requests' AND column_name='fee_applied'
  ) THEN
    ALTER TABLE public.cashout_requests ADD COLUMN fee_applied numeric(12,2);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='cashout_requests' AND column_name='usd_after_fee'
  ) THEN
    ALTER TABLE public.cashout_requests ADD COLUMN usd_after_fee numeric(12,2);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='cashout_requests' AND column_name='transaction_ref'
  ) THEN
    ALTER TABLE public.cashout_requests ADD COLUMN transaction_ref text;
  END IF;
END$$;

