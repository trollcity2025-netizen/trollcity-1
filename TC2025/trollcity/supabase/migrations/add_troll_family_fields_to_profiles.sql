-- Add troll family fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS troll_family_name TEXT,
ADD COLUMN IF NOT EXISTS troll_family_id UUID,
ADD COLUMN IF NOT EXISTS owns_troll_family BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_troll_family_member BOOLEAN DEFAULT FALSE;