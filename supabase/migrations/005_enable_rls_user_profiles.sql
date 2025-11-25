-- 005_enable_rls_user_profiles.sql
-- Enable Row Level Security and owner-only policies for user_profiles

BEGIN;

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert a profile only for themselves
CREATE POLICY "Insert own profile" ON public.user_profiles
  FOR INSERT
  WITH CHECK ( auth.uid() = id );

-- Allow users to select only their own profile
CREATE POLICY "Select own profile" ON public.user_profiles
  FOR SELECT
  USING ( auth.uid() = id );

-- Allow users to update only their own profile
CREATE POLICY "Update own profile" ON public.user_profiles
  FOR UPDATE
  USING ( auth.uid() = id )
  WITH CHECK ( auth.uid() = id );

COMMIT;
