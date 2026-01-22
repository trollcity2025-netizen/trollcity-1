-- Migration: Fix Ambiguous record_daily_login_post Function
-- Purpose: Drop all variations of record_daily_login_post and recreate the correct one to resolve "ambiguous function" error.
-- Date: January 22, 2026

-- 1. Drop potentially ambiguous functions
DROP FUNCTION IF EXISTS public.record_daily_login_post(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.record_daily_login_post(INTEGER, UUID);

-- 2. Recreate the correct function (matching 20270121070000_daily_login_posts_system.sql)
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

  -- Insert the record
  INSERT INTO public.daily_login_posts (user_id, post_id, coins_earned, posted_at)
  VALUES (v_user_id, p_post_id, p_coins, NOW());

  -- Update the post to mark it as a daily login post
  UPDATE public.troll_wall_posts
  SET is_daily_login_post = TRUE
  WHERE id = p_post_id;

  -- Award coins to the user
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + p_coins
  WHERE id = v_user_id;

  RETURN QUERY SELECT true, p_coins, 'Daily login reward claimed!'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
