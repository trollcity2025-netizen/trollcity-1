-- Fix: Ensure user profiles are created automatically on signup
-- Problem: The handle_user_signup trigger was commented out in migration 20270127000000_fix_signup_trigger_legacy.sql
-- This caused new users to not have profiles created, leading to FK constraint errors when sending likes/messages

-- 1. First, ensure the handle_user_signup function exists and is correct
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
BEGIN
  v_email := COALESCE(NEW.email, '');

  -- Always use ID-based username to ensure uniqueness
  -- Format: user + first 8 chars of UUID (without dashes)
  v_username := 'user' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  
  -- Default avatar logic
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_username
  );
  
  -- Set role based on email (admin check)
  IF v_email = 'trollcity2025@gmail.com' THEN
    v_role := 'admin';
  ELSE
    v_role := 'user';
  END IF;

  -- Create user profile
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
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create welcome coin transaction
  INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
  VALUES (NEW.id, 'purchase', 100, 'Welcome bonus coins!', NOW())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail auth user creation
  RAISE WARNING 'Error in handle_user_signup for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. Drop existing trigger if it exists (to avoid errors)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Create the trigger properly
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_signup();

-- 4. Create missing profiles for users who signed up while the trigger was disabled
-- Uses ID-based usernames to guarantee uniqueness
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
  created_at,
  updated_at
)
SELECT 
  au.id,
  -- Always use ID-based username to guarantee uniqueness
  'user' || substr(replace(au.id::text, '-', ''), 1, 8) as username,
  COALESCE(
    au.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || au.id::text
  ) as avatar_url,
  'New troll in the city!' as bio,
  CASE WHEN au.email = 'trollcity2025@gmail.com' THEN 'admin' ELSE 'user' END as role,
  'Bronze' as tier,
  0 as paid_coins,
  100 as troll_coins,
  100 as total_earned_coins,
  0 as total_spent_coins,
  au.email,
  false as terms_accepted,
  COALESCE(au.created_at, NOW()) as created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
WHERE up.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 5. Log how many profiles were created
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON au.id = up.id
  WHERE up.id IS NULL;
  
  IF v_count > 0 THEN
    RAISE NOTICE 'Warning: There are still % users without profiles after the fix', v_count;
  ELSE
    RAISE NOTICE 'Success: All auth.users now have corresponding user_profiles';
  END IF;
END $$;

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_user_signup() TO service_role, authenticated;
