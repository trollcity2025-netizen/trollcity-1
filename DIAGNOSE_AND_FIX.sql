-- COMPREHENSIVE DIAGNOSE AND FIX SCRIPT
-- Run this in Supabase SQL Editor to diagnose and fix the issue

-- Step 1: Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'broadcaster_applications'
    ) THEN 'Table EXISTS ✓'
    ELSE 'Table DOES NOT EXIST ✗'
  END as table_status;

-- Step 2: List ALL columns in the table (to see what actually exists)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcaster_applications'
ORDER BY ordinal_position;

-- Step 3: Check specifically for the missing columns
SELECT 
  'bank_account_last_four' as column_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'broadcaster_applications' 
        AND column_name = 'bank_account_last_four'
    ) THEN 'EXISTS ✓'
    ELSE 'MISSING ✗'
  END as status
UNION ALL
SELECT 
  'id_verification_url' as column_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'broadcaster_applications' 
        AND column_name = 'id_verification_url'
    ) THEN 'EXISTS ✓'
    ELSE 'MISSING ✗'
  END as status
UNION ALL
SELECT 
  'tax_form_url' as column_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'broadcaster_applications' 
        AND column_name = 'tax_form_url'
    ) THEN 'EXISTS ✓'
    ELSE 'MISSING ✗'
  END as status;

-- Step 4: FORCE ADD the columns (even if they might exist)
-- This uses ALTER TABLE which will error if column exists, but we'll catch it
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE public.broadcaster_applications ADD COLUMN bank_account_last_four TEXT;
    RAISE NOTICE 'Added bank_account_last_four';
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'bank_account_last_four already exists';
  END;

  BEGIN
    ALTER TABLE public.broadcaster_applications ADD COLUMN id_verification_url TEXT;
    RAISE NOTICE 'Added id_verification_url';
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'id_verification_url already exists';
  END;

  BEGIN
    ALTER TABLE public.broadcaster_applications ADD COLUMN tax_form_url TEXT;
    RAISE NOTICE 'Added tax_form_url';
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'tax_form_url already exists';
  END;
END $$;

-- Step 5: Verify again after adding
SELECT 
  column_name,
  'NOW EXISTS ✓' as status
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcaster_applications' 
  AND column_name IN ('bank_account_last_four', 'id_verification_url', 'tax_form_url')
ORDER BY column_name;

