-- Ensure admin email is stored and role set correctly for trollcity2025@gmail.com

-- 1) Add email column to user_profiles if missing
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2) Backfill email from auth.users
UPDATE public.user_profiles AS p
SET email = u.email
FROM auth.users AS u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 3) Promote admin email to admin role
UPDATE public.user_profiles
SET role = 'admin', updated_at = NOW()
WHERE email = 'trollcity2025@gmail.com' AND role <> 'admin';

-- 4) Update signup handler to set role based on email and store email
CREATE OR REPLACE FUNCTION public.handle_user_signup()
RETURNS TRIGGER AS $$
BEGIN
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
    email
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || split_part(NEW.email, '@', 1)),
    'New troll in the city!',
    CASE WHEN NEW.email = 'trollcity2025@gmail.com' THEN 'admin' ELSE 'user' END,
    'Bronze',
    0,
    100,
    100,
    0,
    NEW.email
  );

  INSERT INTO public.coin_transactions (user_id, type, amount, description)
  VALUES (NEW.id, 'purchase', 100, 'Welcome bonus coins!');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Re-apply trigger to ensure updated function is used
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_signup();

