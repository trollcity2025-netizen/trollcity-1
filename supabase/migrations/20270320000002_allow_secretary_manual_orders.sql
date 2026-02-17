-- Allow secretaries to manage manual coin orders
BEGIN;

ALTER TABLE public.manual_coin_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage manual orders" ON public.manual_coin_orders;
CREATE POLICY "Admins manage manual orders" ON public.manual_coin_orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
              AND (role IN ('admin', 'super_admin', 'secretary') OR COALESCE(is_admin, false) = true)
        )
    );

COMMIT;
