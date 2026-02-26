
-- Drop the faulty policy that was causing an infinite loop
DROP POLICY IF EXISTS "Allow admins to read all user profiles" ON public.user_profiles;

-- Create the new, non-recursive policy that uses the helper function
CREATE POLICY "Allow admins to read all user profiles" ON public.user_profiles
FOR SELECT
TO authenticated
USING (public.get_my_role() = 'admin');
