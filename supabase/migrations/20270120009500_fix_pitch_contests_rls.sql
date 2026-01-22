-- Fix RLS policies for pitch_contests
-- Ensure admins can manage contests

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pitch_contests') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage contests" ON public.pitch_contests';
        EXECUTE 'CREATE POLICY "Admins can manage contests" ON public.pitch_contests FOR ALL USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = ''admin'' OR is_admin = true)))';
        EXECUTE 'DROP POLICY IF EXISTS "Public can view contests" ON public.pitch_contests';
        EXECUTE 'CREATE POLICY "Public can view contests" ON public.pitch_contests FOR SELECT USING (true)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contest_eligibility') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage eligibility" ON public.contest_eligibility';
        EXECUTE 'CREATE POLICY "Admins can manage eligibility" ON public.contest_eligibility FOR ALL USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = ''admin'' OR is_admin = true)))';
    END IF;
END$$;
