-- Fix admin dashboard users view
-- This migration ensures admins can see all users properly

-- First, ensure RLS is enabled on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop any conflicting SELECT policies
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Select own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.user_profiles;
DROP POLICY IF EXISTS "Anyone can view user profiles" ON public.user_profiles;

-- Create a single comprehensive SELECT policy
CREATE POLICY "Allow everyone to view all user profiles"
  ON public.user_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Ensure user_profiles has email column (for admin dashboard)
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN email text;
  END IF;
END $block$;

-- Create a view that joins auth.users with user_profiles for complete user info
CREATE OR REPLACE VIEW public.admin_users_view AS
SELECT 
  p.id,
  p.username,
  COALESCE(p.email, u.email) as email,
  p.role,
  p.tier,
  p.paid_coin_balance,
  p.free_coin_balance,
  p.total_earned_coins,
  p.total_spent_coins,
  p.avatar_url,
  p.bio,
  p.created_at,
  p.updated_at,
  u.email_confirmed_at,
  u.last_sign_in_at
FROM public.user_profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at DESC;

-- Grant access to the view
GRANT SELECT ON public.admin_users_view TO anon, authenticated;

-- Verify we have users
DO $verify$
DECLARE
  user_count integer;
  profile_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  SELECT COUNT(*) INTO profile_count FROM public.user_profiles;
  
  RAISE NOTICE 'Users in auth.users: %', user_count;
  RAISE NOTICE 'Profiles in user_profiles: %', profile_count;
  
  IF profile_count < user_count THEN
    RAISE WARNING 'Missing % user profiles! Some auth.users do not have user_profiles entries.', (user_count - profile_count);
  END IF;
END $verify$;
