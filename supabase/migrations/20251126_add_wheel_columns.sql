-- Add missing columns for wheel spin functionality
-- Run this in Supabase SQL Editor

-- Add wheel-related columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS badge text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS has_insurance boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS multiplier_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS multiplier_value numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS multiplier_expires timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false;

-- Create wheel_spins table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.wheel_spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  spin_date date NOT NULL,
  spin_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique index to prevent duplicate spins per day
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wheel_spins_user_date 
  ON public.wheel_spins(user_id, spin_date);

-- Enable RLS on wheel_spins
ALTER TABLE public.wheel_spins ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own wheel_spins" ON public.wheel_spins;
DROP POLICY IF EXISTS "Users can insert own wheel_spins" ON public.wheel_spins;
DROP POLICY IF EXISTS "Users can update own wheel_spins" ON public.wheel_spins;

-- Create RLS policies
CREATE POLICY "Users can view own wheel_spins" 
  ON public.wheel_spins 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wheel_spins" 
  ON public.wheel_spins 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wheel_spins" 
  ON public.wheel_spins 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wheel_spins_user ON public.wheel_spins(user_id);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_date ON public.wheel_spins(spin_date);

-- Verify the changes
DO $verify$
DECLARE
  column_count integer;
  table_exists boolean;
BEGIN
  -- Check if badge column exists
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'badge';
  
  RAISE NOTICE 'Badge column exists: %', (column_count > 0);
  
  -- Check if wheel_spins table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'wheel_spins'
  ) INTO table_exists;
  
  RAISE NOTICE 'wheel_spins table exists: %', table_exists;
END $verify$;
