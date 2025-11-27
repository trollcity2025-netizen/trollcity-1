-- Fix cashout_requests table - add missing email column
-- Run this in Supabase SQL Editor

-- Add email column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='cashout_requests' AND column_name='email'
  ) THEN
    ALTER TABLE public.cashout_requests ADD COLUMN email text;
  END IF;
END$$;

-- Verify the table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cashout_requests'
ORDER BY ordinal_position;
