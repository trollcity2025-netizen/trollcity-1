
CREATE TABLE IF NOT EXISTS public.mai_talent_shows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.mai_talent_shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all users to read shows" ON public.mai_talent_shows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admins to manage shows" ON public.mai_talent_shows FOR ALL TO authenticated USING ((SELECT role = 'admin' FROM user_profiles WHERE id = auth.uid())) WITH CHECK ((SELECT role = 'admin' FROM user_profiles WHERE id = auth.uid()));
