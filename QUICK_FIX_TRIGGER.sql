-- QUICKEST FIX: Just drop the trigger and add the column
-- Run this in Supabase SQL Editor

-- Step 1: Drop the problematic trigger
DROP TRIGGER IF EXISTS broadcaster_applications_updated_at ON public.broadcaster_applications;

-- Step 2: Add the missing column
ALTER TABLE public.broadcaster_applications 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 3: Recreate the trigger (now that column exists)
CREATE OR REPLACE FUNCTION update_broadcaster_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broadcaster_applications_updated_at
BEFORE UPDATE ON public.broadcaster_applications
FOR EACH ROW
EXECUTE FUNCTION update_broadcaster_applications_updated_at();

