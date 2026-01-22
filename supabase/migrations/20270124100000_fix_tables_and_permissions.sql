-- Migration: Fix Tables and Permissions
-- 1. Fix payout_requests.amount error by adding a generated column alias
-- This ensures any legacy code querying 'amount' instead of 'cash_amount' still works
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'amount'
  ) THEN
    -- Use a generated column to keep it in sync with cash_amount
    ALTER TABLE payout_requests 
    ADD COLUMN amount numeric(10,2) GENERATED ALWAYS AS (cash_amount) STORED;
  END IF;
END $$;

-- 2. Create admin_broadcasts table if it doesn't exist (Fixes permission denied error)
CREATE TABLE IF NOT EXISTS public.admin_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    admin_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for admin_broadcasts
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read admin_broadcasts (for announcements)
DROP POLICY IF EXISTS "Everyone can read admin_broadcasts" ON public.admin_broadcasts;
CREATE POLICY "Everyone can read admin_broadcasts"
ON public.admin_broadcasts FOR SELECT
USING (true);

-- Policy: Only admins can insert/update/delete admin_broadcasts
DROP POLICY IF EXISTS "Admins can manage admin_broadcasts" ON public.admin_broadcasts;
CREATE POLICY "Admins can manage admin_broadcasts"
ON public.admin_broadcasts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR is_admin = true)
  )
);

-- 3. Fix permissions for streams table
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view streams (needed for landing page/browse)
DROP POLICY IF EXISTS "Everyone can view streams" ON public.streams;
CREATE POLICY "Everyone can view streams"
ON public.streams FOR SELECT
USING (true);

-- Policy: Broadcasters can insert their own streams
DROP POLICY IF EXISTS "Broadcasters can insert streams" ON public.streams;
CREATE POLICY "Broadcasters can insert streams"
ON public.streams FOR INSERT
WITH CHECK (auth.uid() = broadcaster_id);

-- Policy: Broadcasters can update their own streams
DROP POLICY IF EXISTS "Broadcasters can update streams" ON public.streams;
CREATE POLICY "Broadcasters can update streams"
ON public.streams FOR UPDATE
USING (auth.uid() = broadcaster_id);

-- Policy: Admins can manage all streams
DROP POLICY IF EXISTS "Admins can manage all streams" ON public.streams;
CREATE POLICY "Admins can manage all streams"
ON public.streams FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR is_admin = true)
  )
);

-- 4. Ensure admin_settings exists and has policies (just in case)
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB DEFAULT '{}',
    description TEXT,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_broadcast_lockdown" ON public.admin_settings;
CREATE POLICY "public_read_broadcast_lockdown" ON public.admin_settings
  FOR SELECT
  USING (true); -- Allow reading all settings publicly for now to avoid permission issues

DROP POLICY IF EXISTS "admin_can_manage_settings" ON public.admin_settings;
CREATE POLICY "admin_can_manage_settings" ON public.admin_settings
  USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

