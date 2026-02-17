-- Add created_at to user_insurances and vehicle_listings if missing
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_insurances') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_insurances' AND column_name = 'created_at') THEN
      ALTER TABLE public.user_insurances ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_listings') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicle_listings' AND column_name = 'created_at') THEN
      ALTER TABLE public.vehicle_listings ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
  END IF;
END $$;

COMMIT;
