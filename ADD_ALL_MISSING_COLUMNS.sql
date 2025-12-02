-- COMPLETE FIX: Add ALL missing columns to broadcaster_applications
-- Run this in Supabase SQL Editor

-- Add all missing columns at once
ALTER TABLE public.broadcaster_applications 
ADD COLUMN IF NOT EXISTS bank_account_last_four TEXT,
ADD COLUMN IF NOT EXISTS id_verification_url TEXT,
ADD COLUMN IF NOT EXISTS tax_form_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create trigger to auto-update updated_at (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_broadcaster_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then recreate
DROP TRIGGER IF EXISTS broadcaster_applications_updated_at ON public.broadcaster_applications;
CREATE TRIGGER broadcaster_applications_updated_at
BEFORE UPDATE ON public.broadcaster_applications
FOR EACH ROW
EXECUTE FUNCTION update_broadcaster_applications_updated_at();

-- Verify all columns exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'broadcaster_applications'
  AND column_name IN ('bank_account_last_four', 'id_verification_url', 'tax_form_url', 'updated_at')
ORDER BY column_name;

