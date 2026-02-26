
-- Create a policy that allows admins to read all user profiles.
CREATE POLICY "Allow admins to read all user profiles" ON public.user_profiles
FOR SELECT
TO authenticated
USING ((SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin');
