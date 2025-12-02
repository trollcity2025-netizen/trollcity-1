-- Add W9/Onboarding columns to user_profiles if they don't exist
-- These columns are needed for creator onboarding

DO $$
BEGIN
  -- Add address_line1 column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'address_line1'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN address_line1 TEXT;
  END IF;

  -- Add other W9-related columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'legal_full_name'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN legal_full_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN date_of_birth DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'country'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN country TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'city'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN city TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'state_region'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN state_region TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN postal_code TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'tax_id_last4'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN tax_id_last4 TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'tax_classification'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN tax_classification TEXT DEFAULT 'individual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'w9_status'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN w9_status TEXT DEFAULT 'not_submitted';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'w9_verified_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN w9_verified_at TIMESTAMPTZ;
  END IF;
END $$;

