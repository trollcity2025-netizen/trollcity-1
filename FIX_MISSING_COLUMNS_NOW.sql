-- IMMEDIATE FIX: Run this RIGHT NOW in Supabase SQL Editor
-- This will add all missing columns to broadcaster_applications table

-- Add all missing columns in one command
ALTER TABLE public.broadcaster_applications 
ADD COLUMN IF NOT EXISTS bank_account_last_four TEXT,
ADD COLUMN IF NOT EXISTS id_verification_url TEXT,
ADD COLUMN IF NOT EXISTS tax_form_url TEXT;

-- Verify the columns exist (should return 3 rows)
SELECT 
  'bank_account_last_four' as column_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'broadcaster_applications' 
      AND column_name = 'bank_account_last_four'
  ) as exists
UNION ALL
SELECT 
  'id_verification_url' as column_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'broadcaster_applications' 
      AND column_name = 'id_verification_url'
  ) as exists
UNION ALL
SELECT 
  'tax_form_url' as column_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'broadcaster_applications' 
      AND column_name = 'tax_form_url'
  ) as exists;

