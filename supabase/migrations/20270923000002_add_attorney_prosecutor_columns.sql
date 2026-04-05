-- Add missing columns for attorney and prosecutor system
-- These should have been added in earlier migrations but are missing

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_attorney BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_prosecutor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS attorney_fee INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_pro_bono BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS badge_attorney TEXT,
ADD COLUMN IF NOT EXISTS badge_prosecutor TEXT,
ADD COLUMN IF NOT EXISTS attorney_cases_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_background_jailed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS background_jail_reason TEXT,
ADD COLUMN IF NOT EXISTS background_jail_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS background_jail_appealed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS background_jail_appeal_fee INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS has_pending_bond_request BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS negative_balance_allowed BOOLEAN DEFAULT FALSE;

-- Add attorney_cases JSONB if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'attorney_cases'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN attorney_cases JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;