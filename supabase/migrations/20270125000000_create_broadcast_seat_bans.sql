-- Create broadcast_seat_bans table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.broadcast_seat_bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    room TEXT NOT NULL,
    banned_until TIMESTAMPTZ,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.broadcast_seat_bans ENABLE ROW LEVEL SECURITY;

-- Policies

-- 1. Everyone can read bans (needed for clients to know they are banned)
DROP POLICY IF EXISTS "Everyone can read seat bans" ON public.broadcast_seat_bans;
CREATE POLICY "Everyone can read seat bans" ON public.broadcast_seat_bans
    FOR SELECT USING (true);

-- 2. Officers and Admins can manage bans (Insert/Update/Delete)
DROP POLICY IF EXISTS "Officers and Admins can manage seat bans" ON public.broadcast_seat_bans;
CREATE POLICY "Officers and Admins can manage seat bans" ON public.broadcast_seat_bans
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND (
                role IN ('admin', 'lead_troll_officer', 'troll_officer')
                OR is_admin = true
                OR is_lead_officer = true
                OR is_troll_officer = true
            )
        )
    );
