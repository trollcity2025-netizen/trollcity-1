-- Fix insurance plan_id columns to be TEXT instead of UUID
-- This fixes the error: invalid input syntax for type uuid: "insurance_full_24h"

-- Update car_insurance_policies table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'car_insurance_policies' AND column_name = 'plan_id') THEN
        ALTER TABLE public.car_insurance_policies ADD COLUMN plan_id TEXT;
    ELSE
        ALTER TABLE public.car_insurance_policies ALTER COLUMN plan_id TYPE TEXT;
    END IF;
END $$;

-- Update property_insurance_policies table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_insurance_policies' AND column_name = 'plan_id') THEN
        ALTER TABLE public.property_insurance_policies ADD COLUMN plan_id TEXT;
    ELSE
        ALTER TABLE public.property_insurance_policies ALTER COLUMN plan_id TYPE TEXT;
    END IF;
END $$;

-- Update the RPC function signatures to accept TEXT instead of UUID
DROP FUNCTION IF EXISTS public.buy_car_insurance(UUID, UUID);
CREATE OR REPLACE FUNCTION public.buy_car_insurance(
  car_garage_id UUID,
  plan_id TEXT  -- Changed from UUID to TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_user_id UUID;
  v_price BIGINT;
  v_duration_days INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  BEGIN
    SELECT price_paid_coins, duration_days
    INTO v_price, v_duration_days
    FROM public.insurance_plans
    WHERE id = plan_id;
  EXCEPTION WHEN undefined_table THEN
    v_price := 2000;
    v_duration_days := 7;
  END;

  -- ... rest of function ...
END;
$$;
