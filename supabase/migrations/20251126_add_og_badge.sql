-- Add OG badge to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS og_badge boolean DEFAULT false;

-- Create function to automatically grant OG badge to users created before 2026-01-01
CREATE OR REPLACE FUNCTION grant_og_badge_to_early_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-grant OG badge to any user created before January 1, 2026
  IF NEW.created_at < '2026-01-01'::timestamp THEN
    NEW.og_badge = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run before insert on user_profiles
DROP TRIGGER IF EXISTS set_og_badge_on_insert ON public.user_profiles;
CREATE TRIGGER set_og_badge_on_insert
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION grant_og_badge_to_early_users();

-- Grant OG badge to all existing users created before 2026-01-01
UPDATE public.user_profiles
SET og_badge = true
WHERE created_at < '2026-01-01'::timestamp;

-- Verify
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE og_badge = true) as og_badge_holders,
  MIN(created_at) as earliest_user,
  MAX(created_at) as latest_user
FROM public.user_profiles;
