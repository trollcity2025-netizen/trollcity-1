-- FORCE ADD - Run this if the diagnostic shows columns are missing
-- This will add columns even if there are any issues

-- Drop and recreate if needed (CAREFUL - only if table is empty or you're okay with data loss)
-- DO NOT RUN THIS IF YOU HAVE DATA IN THE TABLE!

-- Instead, use this safe approach:
DO $$ 
BEGIN
  -- Force add bank_account_last_four
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'broadcaster_applications' 
      AND column_name = 'bank_account_last_four'
  ) THEN
    EXECUTE 'ALTER TABLE public.broadcaster_applications ADD COLUMN bank_account_last_four TEXT';
    RAISE NOTICE 'SUCCESS: Added bank_account_last_four';
  END IF;

  -- Force add id_verification_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'broadcaster_applications' 
      AND column_name = 'id_verification_url'
  ) THEN
    EXECUTE 'ALTER TABLE public.broadcaster_applications ADD COLUMN id_verification_url TEXT';
    RAISE NOTICE 'SUCCESS: Added id_verification_url';
  END IF;

  -- Force add tax_form_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'broadcaster_applications' 
      AND column_name = 'tax_form_url'
  ) THEN
    EXECUTE 'ALTER TABLE public.broadcaster_applications ADD COLUMN tax_form_url TEXT';
    RAISE NOTICE 'SUCCESS: Added tax_form_url';
  END IF;
END $$;

-- Final verification
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcaster_applications' 
  AND column_name IN ('bank_account_last_four', 'id_verification_url', 'tax_form_url');

