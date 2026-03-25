-- Fix PGRST200: relationship between secretary_assignments and user_profiles
-- Run this directly against your Supabase database (SQL Editor or psql)

ALTER TABLE public.secretary_assignments
DROP CONSTRAINT IF EXISTS secretary_assignments_secretary_id_fkey;

ALTER TABLE public.secretary_assignments
ADD CONSTRAINT secretary_assignments_secretary_id_fkey
FOREIGN KEY (secretary_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.secretary_assignments
DROP CONSTRAINT IF EXISTS secretary_assignments_assigned_by_fkey;

ALTER TABLE public.secretary_assignments
ADD CONSTRAINT secretary_assignments_assigned_by_fkey
FOREIGN KEY (assigned_by) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
