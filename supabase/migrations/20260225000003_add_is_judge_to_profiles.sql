
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS is_judge BOOLEAN DEFAULT false;
