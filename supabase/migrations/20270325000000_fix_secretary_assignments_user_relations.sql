-- Fix for PGRST200: Could not find a relationship between 'secretary_assignments' and 'user_profiles'
-- Foreign keys pointed to auth.users instead of public.user_profiles, preventing PostgREST relational joins.

-- 1. secretary_id: drop FK to auth.users, add FK to public.user_profiles
ALTER TABLE public.secretary_assignments
DROP CONSTRAINT IF EXISTS secretary_assignments_secretary_id_fkey;

ALTER TABLE public.secretary_assignments
ADD CONSTRAINT secretary_assignments_secretary_id_fkey
FOREIGN KEY (secretary_id)
REFERENCES public.user_profiles(id)
ON DELETE CASCADE;

-- 2. assigned_by: drop FK to auth.users, add FK to public.user_profiles
ALTER TABLE public.secretary_assignments
DROP CONSTRAINT IF EXISTS secretary_assignments_assigned_by_fkey;

ALTER TABLE public.secretary_assignments
ADD CONSTRAINT secretary_assignments_assigned_by_fkey
FOREIGN KEY (assigned_by)
REFERENCES public.user_profiles(id)
ON DELETE CASCADE;

-- 3. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
