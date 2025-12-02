-- ============================================
-- STEP 1: DIAGNOSE - See what columns exist
-- ============================================
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcaster_applications'
ORDER BY ordinal_position;

-- ============================================
-- STEP 2: ADD MISSING COLUMNS
-- ============================================
-- Run these one at a time if the combined version doesn't work

ALTER TABLE public.broadcaster_applications 
ADD COLUMN IF NOT EXISTS id_verification_url TEXT;

ALTER TABLE public.broadcaster_applications 
ADD COLUMN IF NOT EXISTS bank_account_last_four TEXT;

ALTER TABLE public.broadcaster_applications 
ADD COLUMN IF NOT EXISTS tax_form_url TEXT;

ALTER TABLE public.broadcaster_applications 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- STEP 3: VERIFY - Should show 3 rows
-- ============================================
SELECT 
  column_name,
  'EXISTS' as status
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcaster_applications' 
  AND column_name IN ('id_verification_url', 'bank_account_last_four', 'tax_form_url');

