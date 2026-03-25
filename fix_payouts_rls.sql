-- Fix "permission denied for table users" on payouts
-- The old "Admins can view all payouts" policy queries auth.users directly,
-- which the authenticated client cannot access. Replace it with a policy
-- that checks user_profiles instead.

DROP POLICY IF EXISTS "Admins can view all payouts" ON public.payouts;

CREATE POLICY "Admins can view all payouts" ON public.payouts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role = 'admin' OR role = 'secretary')
  )
);

NOTIFY pgrst, 'reload schema';
