BEGIN;

-- 1. Secure user_profiles table
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Ensure necessary columns exist to prevent trigger failures
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;


-- 2. Remove all existing policies to ensure clean slate (and remove public/anon access)
DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles' 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', pol.policyname); 
    END LOOP; 
END $$;

-- 3. Revoke all permissions from anon and public (Zero Trust)
REVOKE ALL ON public.user_profiles FROM anon;
REVOKE ALL ON public.user_profiles FROM public;

-- 4. Grant necessary permissions to authenticated users (SELECT, UPDATE only - INSERT is via trigger)
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;

-- 5. Create strict policies
-- "Authenticated users may SELECT/UPDATE only their own profile."
CREATE POLICY "Users can view own profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 6. Ensure Trigger Function is Secure
-- Redefine handle_user_signup as SECURITY DEFINER owned by postgres
CREATE OR REPLACE FUNCTION public.handle_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_username text;
  v_avatar_url text;
  v_email text;
  v_role text;
  v_terms_accepted boolean;
BEGIN
  v_email := COALESCE(NEW.email, '');
  
  -- Default username logic
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NULLIF(split_part(v_email, '@', 1), ''),
    'user' || substr(replace(NEW.id::text, '-', ''), 1, 8)
  );

  -- Default avatar logic
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_username
  );

  -- Force role to user (service role/admin must be set manually or via other secure methods)
  v_role := 'user';
  
  -- Extract terms_accepted from metadata (default to false if missing)
  v_terms_accepted := COALESCE((NEW.raw_user_meta_data->>'terms_accepted')::boolean, false);

  -- Insert User Profile
  -- We try to insert all known columns. If onboarding_completed is missing in schema, this might fail, 
  -- but we assume the schema is up to date with migrations.
  INSERT INTO public.user_profiles (
    id,
    username,
    avatar_url,
    bio,
    role,
    tier,
    paid_coins,
    troll_coins,
    total_earned_coins,
    total_spent_coins,
    email,
    terms_accepted,
    onboarding_completed,
    credit_score, -- Added credit_score
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_username,
    v_avatar_url,
    'New troll in the city!',
    v_role,
    'Bronze',
    0,
    100,
    100,
    0,
    v_email,
    v_terms_accepted,
    false,
    400, -- Default credit score
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create welcome coin transaction
  INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
  VALUES (NEW.id, 'purchase', 100, 'Welcome bonus coins!', NOW())
  ON CONFLICT DO NOTHING;
  
  -- Create user credit
  INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
  VALUES (NEW.id, 400, 'Building', 0, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail auth user creation if possible, though strictness might prefer failure. 
  -- For now, we log and allow.
  RAISE WARNING 'Error in handle_user_signup for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Critical: Ensure function is owned by postgres to bypass RLS
ALTER FUNCTION public.handle_user_signup() OWNER TO postgres;

-- 7. Ensure Trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_signup();

COMMIT;
