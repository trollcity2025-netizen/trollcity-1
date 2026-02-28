-- ============================================================================
-- FIX: Signup 500 Error - "Database error creating new user"
-- Issue: Trigger on_auth_user_created is not attached to auth.users
-- ============================================================================

-- 1. First, ensure all required columns exist on user_profiles
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'Bronze',
  ADD COLUMN IF NOT EXISTS paid_coins BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS troll_coins BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned_coins BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent_coins BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_score INTEGER DEFAULT 400 CHECK (credit_score >= 0 AND credit_score <= 800);

-- 2. Ensure user_credit table exists (trigger depends on this)
CREATE TABLE IF NOT EXISTS public.user_credit (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 400 CHECK (score >= 0 AND score <= 800),
  tier TEXT NOT NULL DEFAULT 'Building',
  trend_7d SMALLINT NOT NULL DEFAULT 0,
  loan_reliability NUMERIC(5,2) NOT NULL DEFAULT 0,
  components JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_event_at TIMESTAMPTZ
);

-- 3. Create or replace the handle_user_signup function with robust error handling
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

  -- Set role from metadata or default to 'user'
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  
  -- Safe Boolean Parsing for terms_accepted
  BEGIN
    v_terms_accepted := (NEW.raw_user_meta_data->>'terms_accepted')::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_terms_accepted := false;
  END;
  v_terms_accepted := COALESCE(v_terms_accepted, false);

  -- Main Profile Insert (Must succeed - this is critical)
  BEGIN
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
      credit_score,
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
      100,  -- Welcome bonus: 100 troll_coins
      100,  -- Track the bonus
      0,
      v_email,
      v_terms_accepted,
      false,
      400,  -- Default credit score (matches user_credit default)
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    -- If profile insert fails, we must raise an error to fail the transaction
    -- because the auth user would be created without a profile
    RAISE EXCEPTION 'Failed to create user profile for %: %', NEW.id, SQLERRM;
  END;

  -- Auxiliary: User Credit (Safe to fail, wrapped in exception handler)
  BEGIN
    INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
    VALUES (NEW.id, 400, 'Building', 0, NOW())
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error inserting user_credit for %: %', NEW.id, SQLERRM;
  END;

  -- Auxiliary: Coin Transaction for welcome bonus (Safe to fail)
  BEGIN
    INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
    VALUES (NEW.id, 'purchase', 100, 'Welcome bonus coins!', NOW())
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error inserting coin_transaction for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 4. Critical: Ensure function is owned by postgres to bypass RLS
ALTER FUNCTION public.handle_user_signup() OWNER TO postgres;

-- 5. Drop any existing conflicting triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_credit ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_troll_coins ON auth.users;

-- 6. Create the main trigger (THIS WAS MISSING!)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_signup();

-- 7. Enable RLS on user_credit if not already enabled
ALTER TABLE public.user_credit ENABLE ROW LEVEL SECURITY;

-- 8. Add RLS policy for user_credit (owner can read)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_credit' AND policyname = 'user_credit_select_owner'
  ) THEN
    CREATE POLICY user_credit_select_owner ON public.user_credit FOR SELECT 
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- 9. Grant necessary permissions
GRANT SELECT ON public.user_credit TO authenticated;

-- 10. Verify the trigger was created
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Success message
SELECT 'Signup trigger fix applied successfully! The on_auth_user_created trigger is now attached to auth.users.' AS status;
