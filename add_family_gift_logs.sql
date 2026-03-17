-- Family Gift Logs Table
-- Tracks coin gifts sent to families for goals

CREATE TABLE IF NOT EXISTS public.family_gift_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    amount INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_family_gift_logs_family ON public.family_gift_logs(family_id);
CREATE INDEX IF NOT EXISTS idx_family_gift_logs_user ON public.family_gift_logs(user_id);

-- Enable RLS
ALTER TABLE public.family_gift_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone in the family can view gift logs
CREATE POLICY "Family members can view gift logs"
    ON public.family_gift_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members 
            WHERE family_id = family_gift_logs.family_id 
            AND user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.troll_family_members 
            WHERE family_id = family_gift_logs.family_id 
            AND user_id = auth.uid()
        )
    );

-- Policy: Any authenticated user can insert gift logs (for their own gifts)
CREATE POLICY "Users can insert their own gift logs"
    ON public.family_gift_logs FOR INSERT
    WITH CHECK (user_id = auth.uid());

SELECT 'Family gift logs table created successfully!' as result;
