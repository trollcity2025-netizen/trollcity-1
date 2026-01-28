-- Create pitches table
CREATE TABLE IF NOT EXISTS public.pitches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contest_id UUID REFERENCES public.pitch_contests(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    vote_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for pitches
ALTER TABLE public.pitches ENABLE ROW LEVEL SECURITY;

-- Policies for pitches
CREATE POLICY "Public view pitches" ON public.pitches FOR SELECT USING (true);

CREATE POLICY "Users can submit pitches" ON public.pitches FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pitches" ON public.pitches FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage pitches" ON public.pitches FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role IN ('admin', 'troll_officer', 'lead_troll_officer') OR is_admin = true)
    )
);

-- Create revenue_splits table
CREATE TABLE IF NOT EXISTS public.revenue_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pitch_id UUID REFERENCES public.pitches(id) ON DELETE CASCADE NOT NULL,
    recipient_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    percentage NUMERIC NOT NULL CHECK (percentage > 0 AND percentage <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for revenue_splits
ALTER TABLE public.revenue_splits ENABLE ROW LEVEL SECURITY;

-- Policies for revenue_splits
CREATE POLICY "Public view splits" ON public.revenue_splits FOR SELECT USING (true);

CREATE POLICY "Admins can manage splits" ON public.revenue_splits FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role IN ('admin', 'troll_officer', 'lead_troll_officer') OR is_admin = true)
    )
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_pitches_contest_id ON public.pitches(contest_id);
CREATE INDEX IF NOT EXISTS idx_pitches_user_id ON public.pitches(user_id);
CREATE INDEX IF NOT EXISTS idx_revenue_splits_pitch_id ON public.revenue_splits(pitch_id);
