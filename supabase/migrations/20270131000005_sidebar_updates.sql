
-- Create sidebar_updates table
CREATE TABLE IF NOT EXISTS public.sidebar_updates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    path TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE
);

-- Create user_sidebar_views table
CREATE TABLE IF NOT EXISTS public.user_sidebar_views (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, path)
);

-- RLS for sidebar_updates
ALTER TABLE public.sidebar_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view active updates" ON public.sidebar_updates;
CREATE POLICY "Everyone can view active updates" ON public.sidebar_updates 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage updates" ON public.sidebar_updates;
CREATE POLICY "Admins can manage updates" ON public.sidebar_updates 
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
    );

-- RLS for user_sidebar_views
ALTER TABLE public.user_sidebar_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own views" ON public.user_sidebar_views;
CREATE POLICY "Users can manage own views" ON public.user_sidebar_views 
    FOR ALL USING (auth.uid() = user_id);

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sidebar_updates;

-- Helper RPC to mark as viewed
CREATE OR REPLACE FUNCTION public.mark_sidebar_viewed(p_path TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_sidebar_views (user_id, path, last_viewed_at)
    VALUES (auth.uid(), p_path, NOW())
    ON CONFLICT (user_id, path) 
    DO UPDATE SET last_viewed_at = NOW();
END;
$$;
