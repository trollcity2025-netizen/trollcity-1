-- Fix user_profiles SELECT policy to allow anyone to view profiles
-- This is needed for the home page "New Trollerz" section

-- Drop existing select policies
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Select own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.user_profiles;

-- Create a single, clear policy that allows everyone to SELECT all profiles
CREATE POLICY "Anyone can view user profiles"
  ON public.user_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Ensure existing update policy is still in place
DO $block$
BEGIN
  -- Drop old update policies
  DROP POLICY IF EXISTS "user_profiles_update_self" ON public.user_profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
  DROP POLICY IF EXISTS "Update own profile" ON public.user_profiles;
  
  -- Create update policy for own profile
  CREATE POLICY "Users can update own profile"
    ON public.user_profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
    
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $block$;
