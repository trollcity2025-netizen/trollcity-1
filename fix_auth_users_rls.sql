-- Fix all RLS policies that query auth.users directly
-- The authenticated client has no SELECT permission on auth.users,
-- causing "permission denied for table users" errors.

-- ============================================================================
-- 1. payouts: "Admins can view all payouts"
-- ============================================================================
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

-- ============================================================================
-- 2. user_content_approvals (table may not exist)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_content_approvals') THEN
    DROP POLICY IF EXISTS "Secretaries can view all content approvals" ON public.user_content_approvals;
    CREATE POLICY "Secretaries can view all content approvals" ON public.user_content_approvals
    FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM public.secretary_assignments WHERE secretary_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
    );

    DROP POLICY IF EXISTS "Secretaries can update content approvals" ON public.user_content_approvals;
    CREATE POLICY "Secretaries can update content approvals" ON public.user_content_approvals
    FOR UPDATE
    USING (
      EXISTS (SELECT 1 FROM public.secretary_assignments WHERE secretary_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
    );
  END IF;
END $$;

-- ============================================================================
-- 3. business_reports (table may not exist)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_reports') THEN
    DROP POLICY IF EXISTS "Secretaries can manage all business reports" ON public.business_reports;
    CREATE POLICY "Secretaries can manage all business reports" ON public.business_reports
    FOR ALL
    USING (
      EXISTS (SELECT 1 FROM public.secretary_assignments WHERE secretary_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
    );
  END IF;
END $$;

-- ============================================================================
-- 4. featured_broadcasts (table may not exist)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'featured_broadcasts') THEN
    DROP POLICY IF EXISTS "System can manage featured broadcasts" ON public.featured_broadcasts;
    CREATE POLICY "System can manage featured broadcasts" ON public.featured_broadcasts
    FOR ALL
    USING (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
    );
  END IF;
END $$;

-- ============================================================================
-- 5. broadcast_rankings (table may not exist)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'broadcast_rankings') THEN
    DROP POLICY IF EXISTS "System can manage rankings" ON public.broadcast_rankings;
    CREATE POLICY "System can manage rankings" ON public.broadcast_rankings
    FOR ALL
    USING (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
    );
  END IF;
END $$;

-- ============================================================================
-- 6. weekly_top_broadcasters (table may not exist)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'weekly_top_broadcasters') THEN
    DROP POLICY IF EXISTS "System can manage weekly top" ON public.weekly_top_broadcasters;
    CREATE POLICY "System can manage weekly top" ON public.weekly_top_broadcasters
    FOR ALL
    USING (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
