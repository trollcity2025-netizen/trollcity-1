-- Fix: Add public read access for city_ads
-- Run this in Supabase SQL Editor to allow unauthenticated users to view ads on homepage

-- Drop existing authenticated-only policy
DROP POLICY IF EXISTS "Admins can do everything with city_ads" ON public.city_ads;

-- Create public read policy (everyone can view active ads)
CREATE POLICY "Public can read active city_ads"
ON public.city_ads FOR SELECT
TO public
USING (is_active = true);

-- Create authenticated policy for admins/secretaries to do everything else
CREATE POLICY "Admins can manage city_ads"
ON public.city_ads FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (role = 'admin' OR role = 'secretary')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.secretary_assignments
        WHERE secretary_id = auth.uid()
    )
);

-- Verify the policies are set up correctly
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'city_ads';
