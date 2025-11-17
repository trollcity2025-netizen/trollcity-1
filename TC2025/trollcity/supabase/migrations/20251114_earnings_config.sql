-- Migration: create earnings_config table for admin-configurable earnings settings
CREATE TABLE IF NOT EXISTS public.earnings_config (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bronze_tier_requirement INTEGER DEFAULT 1000,
  bronze_tier_payout DECIMAL(10, 2) DEFAULT 50.00,
  silver_tier_requirement INTEGER DEFAULT 5000,
  silver_tier_payout DECIMAL(10, 2) DEFAULT 250.00,
  gold_tier_requirement INTEGER DEFAULT 20000,
  gold_tier_payout DECIMAL(10, 2) DEFAULT 1200.00,
  platinum_tier_requirement INTEGER DEFAULT 100000,
  platinum_tier_payout DECIMAL(10, 2) DEFAULT 8000.00,
  transaction_fee_percentage DECIMAL(5, 2) DEFAULT 2.9,
  transaction_fee_fixed_cents INTEGER DEFAULT 30,
  minimum_payout DECIMAL(10, 2) DEFAULT 10.00,
  payment_processing_days INTEGER DEFAULT 3,
  square_account_active BOOLEAN DEFAULT false,
  square_application_id TEXT,
  square_location_id TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Only one config row should exist; create the default
INSERT INTO public.earnings_config DEFAULT VALUES;

-- Optionally: create a function to ensure only one row
CREATE OR REPLACE FUNCTION public.prevent_earnings_config_duplicates()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.earnings_config) > 1 THEN
    RAISE EXCEPTION 'Only one earnings_config row is allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER earnings_config_single_row
BEFORE INSERT ON public.earnings_config
FOR EACH ROW
EXECUTE FUNCTION prevent_earnings_config_duplicates();
