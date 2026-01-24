-- Fix RLS for coin_audit_log and ensure table exists
CREATE TABLE IF NOT EXISTS public.coin_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.user_profiles(id),
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coin_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow inserts from authenticated users (for logging their own actions)
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.coin_audit_log;
CREATE POLICY "Users can insert audit logs" ON public.coin_audit_log
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access audit logs" ON public.coin_audit_log;
CREATE POLICY "Service role full access audit logs" ON public.coin_audit_log
    USING (true) WITH CHECK (true);

-- Allow admins to view all logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.coin_audit_log;
CREATE POLICY "Admins can view all audit logs" ON public.coin_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
        )
    );
