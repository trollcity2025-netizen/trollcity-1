-- Daily Login Posts System Migration
-- Implements once-per-day post limit with coin rewards

-- 1) Create daily_login_posts table
CREATE TABLE IF NOT EXISTS public.daily_login_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.troll_wall_posts(id) ON DELETE CASCADE,
  coins_earned INTEGER NOT NULL DEFAULT 0 CHECK (coins_earned >= 0 AND coins_earned <= 100),
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create a unique index on user_id and the date part of posted_at (using UTC to ensure immutability)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_login_posts_user_date_unique 
ON public.daily_login_posts (user_id, ((posted_at AT TIME ZONE 'UTC')::date));

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_login_posts_user_id ON public.daily_login_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_login_posts_posted_at ON public.daily_login_posts(posted_at DESC);
-- idx_daily_login_posts_user_date_unique handles the user_date lookup

-- Enable RLS
ALTER TABLE public.daily_login_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'daily_login_posts' AND policyname = 'daily_login_posts_select_own'
    ) THEN
        CREATE POLICY daily_login_posts_select_own
          ON public.daily_login_posts FOR SELECT
          USING (auth.uid() = user_id OR auth.role() = 'service_role');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'daily_login_posts' AND policyname = 'daily_login_posts_insert_service'
    ) THEN
        CREATE POLICY daily_login_posts_insert_service
          ON public.daily_login_posts FOR INSERT
          WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'daily_login_posts' AND policyname = 'daily_login_posts_update_service'
    ) THEN
        CREATE POLICY daily_login_posts_update_service
          ON public.daily_login_posts FOR UPDATE
          USING (auth.role() = 'service_role');
    END IF;
END $$;

-- 2) RPC Function: record_daily_login_post with proper once-per-day enforcement
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.record_daily_login_post(UUID, INTEGER) TO authenticated, service_role;

-- 3) Update troll_wall_posts table to mark daily login posts
ALTER TABLE public.troll_wall_posts
ADD COLUMN IF NOT EXISTS is_daily_login_post BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_troll_wall_posts_daily_login ON public.troll_wall_posts(is_daily_login_post, created_at DESC) WHERE is_daily_login_post = true;
