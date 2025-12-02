-- Fix the trigger that's causing the "record 'new' has no field 'updated_at'" error
-- Run this in Supabase SQL Editor

-- Option 1: Drop the trigger temporarily (safest)
DROP TRIGGER IF EXISTS broadcaster_applications_updated_at ON public.broadcaster_applications;

-- Option 2: Add the column first, then recreate trigger
ALTER TABLE public.broadcaster_applications 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Now recreate the trigger (only if column exists)
CREATE OR REPLACE FUNCTION update_broadcaster_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'broadcaster_applications' 
      AND column_name = 'updated_at'
  ) THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER broadcaster_applications_updated_at
BEFORE UPDATE ON public.broadcaster_applications
FOR EACH ROW
EXECUTE FUNCTION update_broadcaster_applications_updated_at();

