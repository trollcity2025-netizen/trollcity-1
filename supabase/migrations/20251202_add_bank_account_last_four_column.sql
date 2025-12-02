-- Add missing columns to broadcaster_applications if they don't exist
-- This fixes the schema cache issue where columns were missing
-- 
-- INSTRUCTIONS:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. After running, wait 1-2 minutes for schema cache to refresh
-- 3. If error persists, try refreshing your browser or restarting your app

DO $$ 
BEGIN
  -- Add bank_account_last_four column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'broadcaster_applications' 
      AND column_name = 'bank_account_last_four'
  ) THEN
    ALTER TABLE public.broadcaster_applications 
    ADD COLUMN bank_account_last_four TEXT;
    
    RAISE NOTICE 'Added bank_account_last_four column to broadcaster_applications';
  ELSE
    RAISE NOTICE 'Column bank_account_last_four already exists';
  END IF;

  -- Add id_verification_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'broadcaster_applications' 
      AND column_name = 'id_verification_url'
  ) THEN
    ALTER TABLE public.broadcaster_applications 
    ADD COLUMN id_verification_url TEXT;
    
    RAISE NOTICE 'Added id_verification_url column to broadcaster_applications';
  ELSE
    RAISE NOTICE 'Column id_verification_url already exists';
  END IF;

  -- Add tax_form_url column if it doesn't exist (for completeness)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'broadcaster_applications' 
      AND column_name = 'tax_form_url'
  ) THEN
    ALTER TABLE public.broadcaster_applications 
    ADD COLUMN tax_form_url TEXT;
    
    RAISE NOTICE 'Added tax_form_url column to broadcaster_applications';
  ELSE
    RAISE NOTICE 'Column tax_form_url already exists';
  END IF;
END $$;

-- Verify all columns were added (should return 3 rows)
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcaster_applications' 
  AND column_name IN ('bank_account_last_four', 'id_verification_url', 'tax_form_url')
ORDER BY column_name;

