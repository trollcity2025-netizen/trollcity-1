-- Fix Ambiguous record_daily_login_post Function (Final)
-- Drops all variations and recreates the canonical one.

-- Drop possible variations
DROP FUNCTION IF EXISTS public.record_daily_login_post(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.record_daily_login_post(INTEGER, UUID);

-- Recreate the correct function
CREATE OR REPLACE FUNCTION public.record_daily_login_post(
  p_post_id UUID,
  p_coins INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  coins_earned INTEGER,
  message TEXT
) AS $$
DECLARE
  v_user_id UUID;
  v_already_posted BOOLEAN;
  v_inserted_id UUID;
BEGIN
  -- Get the user ID from the post
  SELECT user_id INTO v_user_id FROM public.troll_wall_posts WHERE id = p_post_id;
  
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 0::INTEGER, 'Post not found'::TEXT;
    RETURN;
  END IF;

  -- Check if user has already posted TODAY
  SELECT EXISTS(
    SELECT 1 FROM public.daily_login_posts
    WHERE user_id = v_user_id
    AND DATE(posted_at) = DATE(NOW())
  ) INTO v_already_posted;

  IF v_already_posted THEN
    RETURN QUERY SELECT false, 0::INTEGER, 'You have already posted today. Come back tomorrow!'::TEXT;
    RETURN;
  END IF;

  -- Clamp coins to 0-100 range
  p_coins := GREATEST(0, LEAST(100, p_coins));

  -- Try to insert the daily login post
  BEGIN
    INSERT INTO public.daily_login_posts (user_id, post_id, coins_earned, posted_at)
    VALUES (v_user_id, p_post_id, p_coins, NOW())
    RETURNING id INTO v_inserted_id;

    -- Award coins to user
    UPDATE public.user_profiles
    SET 
      free_troll_coins = free_troll_coins + p_coins,
      total_earned_coins = total_earned_coins + p_coins,
      updated_at = NOW()
    WHERE id = v_user_id;

    RETURN QUERY SELECT true, p_coins, 'Daily post recorded and coins awarded'::TEXT;
  EXCEPTION WHEN unique_violation THEN
    -- Already posted today - this handles the race condition
    RETURN QUERY SELECT false, 0::INTEGER, 'You have already posted today. Come back tomorrow!'::TEXT;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.record_daily_login_post(UUID, INTEGER) TO authenticated, service_role;
