-- Empire Partner Program (Referral System) Overhaul
-- Adds: onboarding tracking, founding partner system, referral bonuses, qualification logic

-- 1. Add new columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS referred_by_user_id uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS qualified_referral_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_qualified_referral boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS founding_partner boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS founding_partner_rank integer,
  ADD COLUMN IF NOT EXISTS referred_user_bonus_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_coins_at_signup bigint DEFAULT 0;

-- 2. Ensure existing empire partner columns exist
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_empire_partner boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS empire_partner boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_status text,
  ADD COLUMN IF NOT EXISTS empire_role text CHECK (empire_role IN ('partner') OR empire_role IS NULL);

-- 3. Indexes for referral queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_referred_by ON public.user_profiles(referred_by_user_id) WHERE referred_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_founding_partner ON public.user_profiles(founding_partner) WHERE founding_partner = true;
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding ON public.user_profiles(onboarding_complete) WHERE onboarding_complete = false;

-- 4. Function: Get referral stats for a user
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total integer;
  v_qualified integer;
  v_pending integer;
  v_in_progress integer;
  v_founding boolean;
  v_founding_rank integer;
  v_founding_spots_taken integer;
BEGIN
  -- Count total referrals
  SELECT COUNT(*) INTO v_total
  FROM public.user_profiles
  WHERE referred_by_user_id = p_user_id;

  -- Count qualified referrals
  SELECT COUNT(*) INTO v_qualified
  FROM public.user_profiles
  WHERE referred_by_user_id = p_user_id
    AND is_qualified_referral = true;

  -- Count pending (signed up but onboarding not complete)
  SELECT COUNT(*) INTO v_pending
  FROM public.user_profiles
  WHERE referred_by_user_id = p_user_id
    AND (onboarding_complete = false OR onboarding_complete IS NULL);

  -- Count in progress (onboarding complete but < 5000 coins)
  SELECT COUNT(*) INTO v_in_progress
  FROM public.user_profiles
  WHERE referred_by_user_id = p_user_id
    AND onboarding_complete = true
    AND is_qualified_referral = false;

  -- Get founding status
  SELECT founding_partner, founding_partner_rank INTO v_founding, v_founding_rank
  FROM public.user_profiles
  WHERE id = p_user_id;

  -- Count founding spots taken
  SELECT COUNT(*) INTO v_founding_spots_taken
  FROM public.user_profiles
  WHERE founding_partner = true;

  RETURN json_build_object(
    'total_referrals', v_total,
    'qualified_referrals', v_qualified,
    'pending_referrals', v_pending,
    'in_progress_referrals', v_in_progress,
    'is_founding_partner', COALESCE(v_founding, false),
    'founding_partner_rank', v_founding_rank,
    'founding_spots_taken', v_founding_spots_taken,
    'founding_spots_total', 15
  );
END;
$$;

-- 5. Function: Get referral list for a user
CREATE OR REPLACE FUNCTION public.get_referral_list(p_user_id uuid)
RETURNS TABLE (
  referred_user_id uuid,
  username text,
  avatar_url text,
  troll_coins bigint,
  total_earned_coins bigint,
  onboarding_complete boolean,
  is_qualified_referral boolean,
  qualified_referral_at timestamptz,
  referred_at timestamptz,
  progress_percent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id AS referred_user_id,
    up.username,
    up.avatar_url,
    COALESCE(up.troll_coins, 0) AS troll_coins,
    COALESCE(up.total_earned_coins, 0) AS total_earned_coins,
    COALESCE(up.onboarding_complete, false) AS onboarding_complete,
    COALESCE(up.is_qualified_referral, false) AS is_qualified_referral,
    up.qualified_referral_at,
    up.created_at AS referred_at,
    LEAST(100, ROUND((COALESCE(up.troll_coins, 0)::numeric / 5000) * 100, 1)) AS progress_percent
  FROM public.user_profiles up
  WHERE up.referred_by_user_id = p_user_id
  ORDER BY up.created_at DESC;
END;
$$;

-- 6. Function: Check and qualify referrals (called on coin changes)
CREATE OR REPLACE FUNCTION public.check_referral_qualification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id uuid;
  v_is_self_referral boolean;
  v_existing_qualified integer;
  v_founding_count integer;
BEGIN
  -- Only proceed if user has a referrer
  IF NEW.referred_by_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_referrer_id := NEW.referred_by_user_id;

  -- Check self-referral
  v_is_self_referral := (v_referrer_id = NEW.id);
  IF v_is_self_referral THEN
    RETURN NEW;
  END IF;

  -- Check if already qualified
  IF NEW.is_qualified_referral THEN
    RETURN NEW;
  END IF;

  -- Check qualification: onboarding complete AND >= 5000 coins
  IF COALESCE(NEW.onboarding_complete, false) = true AND COALESCE(NEW.troll_coins, 0) >= 5000 THEN
    -- Mark as qualified
    NEW.is_qualified_referral := true;
    NEW.qualified_referral_at := NOW();
    NEW.referred_user_bonus_active := true;

    -- Activate referrer as empire partner
    UPDATE public.user_profiles
    SET is_empire_partner = true,
        empire_partner = true,
        partner_status = 'active'
    WHERE id = v_referrer_id
      AND (is_empire_partner = false OR is_empire_partner IS NULL);

    -- Check if referrer qualifies for founding partner (first 15 with at least 1 qualified referral)
    SELECT COUNT(*) INTO v_existing_qualified
    FROM public.user_profiles
    WHERE referred_by_user_id = v_referrer_id
      AND is_qualified_referral = true
      AND id != NEW.id;

    -- If this is their first qualified referral, check founding eligibility
    IF v_existing_qualified = 0 THEN
      SELECT COUNT(*) INTO v_founding_count
      FROM public.user_profiles
      WHERE founding_partner = true;

      IF v_founding_count < 15 THEN
        UPDATE public.user_profiles
        SET founding_partner = true,
            founding_partner_rank = v_founding_count + 1
        WHERE id = v_referrer_id
          AND (founding_partner = false OR founding_partner IS NULL);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Trigger: Auto-qualify on coin or onboarding changes
DROP TRIGGER IF EXISTS trg_check_referral_qualification ON public.user_profiles;
CREATE TRIGGER trg_check_referral_qualification
  BEFORE UPDATE OF troll_coins, onboarding_complete ON public.user_profiles
  FOR EACH ROW
  WHEN (NEW.referred_by_user_id IS NOT NULL AND NEW.is_qualified_referral = false)
  EXECUTE FUNCTION public.check_referral_qualification();

-- 8. Function: Mark onboarding complete
CREATE OR REPLACE FUNCTION public.mark_onboarding_complete(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_exists boolean;
BEGIN
  -- Verify user exists and has required fields
  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles
    WHERE id = p_user_id
      AND username IS NOT NULL
      AND length(username) >= 2
  ) INTO v_profile_exists;

  IF NOT v_profile_exists THEN
    RETURN false;
  END IF;

  UPDATE public.user_profiles
  SET onboarding_complete = true
  WHERE id = p_user_id
    AND (onboarding_complete = false OR onboarding_complete IS NULL);

  RETURN true;
END;
$$;

-- 9. Function: Calculate cashout bonus for referred user (+2%)
CREATE OR REPLACE FUNCTION public.get_referred_user_cashout_bonus(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.user_profiles
    WHERE id = p_user_id
      AND referred_user_bonus_active = true
  ) THEN
    RETURN 0.02; -- 2% bonus
  END IF;
  RETURN 0;
END;
$$;

-- 10. Function: Calculate referrer cashout bonus (+25% for founding partners)
CREATE OR REPLACE FUNCTION public.get_referrer_cashout_bonus(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.user_profiles
    WHERE id = p_user_id
      AND founding_partner = true
  ) THEN
    RETURN 0.25; -- 25% bonus
  END IF;
  RETURN 0;
END;
$$;

-- 11. Function: Get referred user's referrer info
CREATE OR REPLACE FUNCTION public.get_my_referrer(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer json;
BEGIN
  SELECT json_build_object(
    'referrer_id', ref.id,
    'username', ref.username,
    'avatar_url', ref.avatar_url
  ) INTO v_referrer
  FROM public.user_profiles up
  JOIN public.user_profiles ref ON ref.id = up.referred_by_user_id
  WHERE up.id = p_user_id
    AND up.referred_by_user_id IS NOT NULL;

  RETURN COALESCE(v_referrer, '{}'::json);
END;
$$;

-- 12. Admin function: Get all referral data for secretary panel
CREATE OR REPLACE FUNCTION public.admin_get_referral_overview()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_referrals integer;
  v_qualified_referrals integer;
  v_onboarding_incomplete integer;
  v_founding_partners integer;
  v_referred_with_bonus integer;
  v_total_bonus_coins bigint;
BEGIN
  SELECT COUNT(*) INTO v_total_referrals
  FROM public.user_profiles
  WHERE referred_by_user_id IS NOT NULL;

  SELECT COUNT(*) INTO v_qualified_referrals
  FROM public.user_profiles
  WHERE is_qualified_referral = true;

  SELECT COUNT(*) INTO v_onboarding_incomplete
  FROM public.user_profiles
  WHERE referred_by_user_id IS NOT NULL
    AND (onboarding_complete = false OR onboarding_complete IS NULL);

  SELECT COUNT(*) INTO v_founding_partners
  FROM public.user_profiles
  WHERE founding_partner = true;

  SELECT COUNT(*) INTO v_referred_with_bonus
  FROM public.user_profiles
  WHERE referred_user_bonus_active = true;

  SELECT COALESCE(SUM(
    COALESCE(up.troll_coins, 0)
  ), 0) INTO v_total_bonus_coins
  FROM public.user_profiles up
  WHERE up.referred_by_user_id IS NOT NULL
    AND up.is_qualified_referral = true;

  RETURN json_build_object(
    'total_referrals', v_total_referrals,
    'qualified_referrals', v_qualified_referrals,
    'onboarding_incomplete', v_onboarding_incomplete,
    'founding_partners', v_founding_partners,
    'referred_with_bonus', v_referred_with_bonus,
    'total_bonus_coins', v_total_bonus_coins
  );
END;
$$;

-- 13. Admin function: Get all referrals table
CREATE OR REPLACE FUNCTION public.admin_get_all_referrals()
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  referred_by_id uuid,
  referred_by_username text,
  troll_coins bigint,
  total_earned_coins bigint,
  onboarding_complete boolean,
  is_qualified_referral boolean,
  qualified_referral_at timestamptz,
  is_founding_partner boolean,
  founding_partner_rank integer,
  referred_user_bonus_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id AS user_id,
    up.username,
    up.avatar_url,
    up.referred_by_user_id AS referred_by_id,
    ref.username AS referred_by_username,
    COALESCE(up.troll_coins, 0) AS troll_coins,
    COALESCE(up.total_earned_coins, 0) AS total_earned_coins,
    COALESCE(up.onboarding_complete, false) AS onboarding_complete,
    COALESCE(up.is_qualified_referral, false) AS is_qualified_referral,
    up.qualified_referral_at,
    COALESCE(up.founding_partner, false) AS is_founding_partner,
    up.founding_partner_rank,
    COALESCE(up.referred_user_bonus_active, false) AS referred_user_bonus_active,
    up.created_at
  FROM public.user_profiles up
  LEFT JOIN public.user_profiles ref ON ref.id = up.referred_by_user_id
  WHERE up.referred_by_user_id IS NOT NULL
  ORDER BY up.created_at DESC;
END;
$$;

-- 14. Admin function: Get all referrers (users who have referrals)
CREATE OR REPLACE FUNCTION public.admin_get_all_referrers()
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  total_referrals integer,
  qualified_referrals integer,
  is_founding_partner boolean,
  founding_partner_rank integer,
  is_empire_partner boolean,
  partner_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id AS user_id,
    up.username,
    up.avatar_url,
    (SELECT COUNT(*)::integer FROM public.user_profiles r WHERE r.referred_by_user_id = up.id) AS total_referrals,
    (SELECT COUNT(*)::integer FROM public.user_profiles r WHERE r.referred_by_user_id = up.id AND r.is_qualified_referral = true) AS qualified_referrals,
    COALESCE(up.founding_partner, false) AS is_founding_partner,
    up.founding_partner_rank,
    COALESCE(up.is_empire_partner, false) AS is_empire_partner,
    up.partner_status
  FROM public.user_profiles up
  WHERE EXISTS (
    SELECT 1 FROM public.user_profiles r WHERE r.referred_by_user_id = up.id
  )
  ORDER BY up.founding_partner_rank NULLS LAST, up.created_at ASC;
END;
$$;

-- 15. Admin function: Toggle founding partner status
CREATE OR REPLACE FUNCTION public.admin_toggle_founding_partner(p_user_id uuid, p_grant boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count integer;
  v_next_rank integer;
BEGIN
  IF p_grant THEN
    -- Check if spots available
    SELECT COUNT(*) INTO v_current_count
    FROM public.user_profiles
    WHERE founding_partner = true;

    IF v_current_count >= 15 THEN
      RAISE EXCEPTION 'All 15 founding partner spots are taken';
    END IF;

    v_next_rank := v_current_count + 1;

    UPDATE public.user_profiles
    SET founding_partner = true,
        founding_partner_rank = v_next_rank,
        is_empire_partner = true,
        empire_partner = true,
        partner_status = 'active'
    WHERE id = p_user_id;
  ELSE
    UPDATE public.user_profiles
    SET founding_partner = false,
        founding_partner_rank = NULL
    WHERE id = p_user_id;
  END IF;

  RETURN true;
END;
$$;

-- 16. Admin function: Toggle referred user bonus
CREATE OR REPLACE FUNCTION public.admin_toggle_referred_bonus(p_user_id uuid, p_active boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_profiles
  SET referred_user_bonus_active = p_active
  WHERE id = p_user_id;

  RETURN true;
END;
$$;

-- 17. Set up auth referral on signup (update existing trigger/handler)
-- This handles the referred_by_user_id population from referral_code
CREATE OR REPLACE FUNCTION public.handle_referral_signup(p_user_id uuid, p_referral_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id uuid;
BEGIN
  IF p_referral_code IS NULL OR p_referral_code = '' THEN
    RETURN false;
  END IF;

  -- Try to find referrer by ID (user ID as referral code)
  SELECT id INTO v_referrer_id
  FROM public.user_profiles
  WHERE id::text = p_referral_code
    AND id != p_user_id;

  IF v_referrer_id IS NULL THEN
    -- Try referral_code column on users table
    SELECT id INTO v_referrer_id
    FROM public.users
    WHERE referral_code = p_referral_code
      AND id != p_user_id;
  END IF;

  IF v_referrer_id IS NULL THEN
    RETURN false;
  END IF;

  -- Prevent self-referral
  IF v_referrer_id = p_user_id THEN
    RETURN false;
  END IF;

  -- Set referred_by_user_id
  UPDATE public.user_profiles
  SET referred_by_user_id = v_referrer_id
  WHERE id = p_user_id
    AND (referred_by_user_id IS NULL);

  -- Also create legacy referrals record
  INSERT INTO public.referrals (referrer_id, referred_user_id, recruiter_id, referred_user_id, reward_status)
  VALUES (v_referrer_id, p_user_id, v_referrer_id, p_user_id, 'pending')
  ON CONFLICT (recruiter_id, referred_user_id) DO NOTHING;

  RETURN true;
END;
$$;

-- 18. Grant permissions
GRANT EXECUTE ON FUNCTION public.get_referral_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_onboarding_complete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referred_user_cashout_bonus(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referrer_cashout_bonus(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referrer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_referral_signup(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_referral_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_referrals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_referrers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_founding_partner(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_referred_bonus(uuid, boolean) TO authenticated;
