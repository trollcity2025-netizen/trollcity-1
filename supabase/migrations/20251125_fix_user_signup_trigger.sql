-- Fix user signup trigger to handle all cases and avoid errors

-- First, ensure the trigger function has proper permissions
-- Drop and recreate with better error handling

DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
DROP TRIGGER IF EXISTS auto_confirm_user_trigger ON auth.users;

-- Auto-confirm users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Auto-confirm the user's email
  UPDATE auth.users 
  SET email_confirmed_at = NOW() 
  WHERE id = NEW.id;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the user creation
  RAISE WARNING 'Error auto-confirming user: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Create user profile with all required fields
CREATE OR REPLACE FUNCTION public.handle_user_signup()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $function$
DECLARE
  v_username text;
  v_avatar_url text;
  v_email text;
  v_role text;
BEGIN
  -- Extract values with proper defaults
  -- Check both raw_user_meta_data and user_metadata for username
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_app_metadata->>'username',
    split_part(NEW.email, '@', 1),
    'user' || substr(NEW.id::text, 1, 8)
  );
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  v_email := COALESCE(NEW.email, '');
  
  -- Set role based on email
  IF v_email = 'trollcity2025@gmail.com' THEN
    v_role := 'admin';
  ELSE
    v_role := 'user';
  END IF;

  -- Insert user profile with all required columns
  INSERT INTO public.user_profiles (
    id,
    username,
    avatar_url,
    bio,
    role,
    tier,
    paid_coin_balance,
    free_coin_balance,
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
  ON CONFLICT (id) DO NOTHING; -- Prevent duplicate key errors

  -- Create welcome coin transaction
  INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
  VALUES (NEW.id, 'purchase', 100, 'Welcome bonus coins!', NOW())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the auth.users insert
  RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- Grant execute permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_user_signup() TO authenticated, service_role;

-- Re-create triggers in correct order
CREATE TRIGGER auto_confirm_user_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_signup();

-- Ensure RLS policies allow the trigger to insert
-- The SECURITY DEFINER should bypass RLS, but let's make sure there's a policy

DO $block$ 
BEGIN
  -- Drop old policies if they exist
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user_profiles;
  DROP POLICY IF EXISTS "Enable insert for service role" ON public.user_profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
  
  -- Create a policy that allows inserts for the user's own ID
  CREATE POLICY "Users can insert own profile" 
    ON public.user_profiles 
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = id);
    
EXCEPTION WHEN duplicate_object THEN
  -- Policy already exists, that's fine
  NULL;
END $block$;
