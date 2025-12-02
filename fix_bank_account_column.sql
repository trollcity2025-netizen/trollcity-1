-- QUICK FIX: Add missing columns to broadcaster_applications
-- Run this directly in Supabase SQL Editor if migration doesn't work

-- Step 1: Add all missing columns
ALTER TABLE public.broadcaster_applications 
ADD COLUMN IF NOT EXISTS bank_account_last_four TEXT,
ADD COLUMN IF NOT EXISTS id_verification_url TEXT,
ADD COLUMN IF NOT EXISTS tax_form_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 2: Verify columns were added (should show 4 rows)
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcaster_applications' 
  AND column_name IN ('bank_account_last_four', 'id_verification_url', 'tax_form_url', 'updated_at')
ORDER BY column_name;

-- Step 3: Check all columns in the table (for debugging)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcaster_applications'
ORDER BY ordinal_position;

