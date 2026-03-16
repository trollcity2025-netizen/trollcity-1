-- Add trollmonds column to user_profiles if it doesn't exist
-- This is needed for the Troll Wheel to store trollmonds winnings

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS trollmonds BIGINT DEFAULT 0;

-- Make sure the column can be null-free by setting a default
ALTER TABLE public.user_profiles 
ALTER COLUMN trollmonds SET DEFAULT 0;

ALTER TABLE public.user_profiles 
ALTER COLUMN trollmonds SET NOT NULL;

-- Grant permissions
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO anon;

-- Create or replace the increment_trollmonds function if it doesn't exist
CREATE OR REPLACE FUNCTION public.increment_trollmonds(p_user_id UUID, p_amount BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_profiles
  SET trollmonds = COALESCE(trollmonds, 0) + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Grant execute permission
GRANT ALL ON FUNCTION public.increment_trollmonds TO authenticated;
GRANT ALL ON FUNCTION public.increment_trollmonds TO anon;
