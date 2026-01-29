-- Add is_landlord to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS is_landlord boolean DEFAULT false;

-- Add columns to properties
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS vacant_units integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS apartment_name text;
