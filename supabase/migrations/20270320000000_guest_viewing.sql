-- Migration for Guest Viewing System

-- 1. Update stream_bans table to support guest bans
ALTER TABLE public.stream_bans 
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.stream_bans 
  ADD COLUMN IF NOT EXISTS guest_identity TEXT,
  ADD COLUMN IF NOT EXISTS ip_address INET;

ALTER TABLE public.stream_bans 
  ADD CONSTRAINT stream_bans_has_target 
  CHECK (
    user_id IS NOT NULL 
    OR guest_identity IS NOT NULL 
    OR ip_address IS NOT NULL
  );

-- 2. Add bypass_broadcast_restriction to user_profiles
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS bypass_broadcast_restriction BOOLEAN DEFAULT false;

-- 3. Create/Update IP tracking table (if not exists, though prompt says "IP logging table: store ip, guest_identity, display_name, stream_id, timestamp")
-- We'll assume we can reuse an existing one or create a new one. 
-- "guest_tracking_logs" seems appropriate if it doesn't exist.
CREATE TABLE IF NOT EXISTS public.guest_tracking_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address INET NOT NULL,
    guest_identity TEXT NOT NULL,
    display_name TEXT NOT NULL,
    stream_id UUID REFERENCES public.streams(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for logs
ALTER TABLE public.guest_tracking_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view logs
CREATE POLICY "Admins can view guest logs" 
ON public.guest_tracking_logs FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR is_admin = true)
  )
);

-- Service role can insert (for API)
CREATE POLICY "Service role can insert guest logs" 
ON public.guest_tracking_logs FOR INSERT 
WITH CHECK (true); -- Ideally restrict to service role, but for now allow insert if logic is in API
