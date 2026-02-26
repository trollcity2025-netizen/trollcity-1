
CREATE TABLE IF NOT EXISTS public.mai_talent_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  show_id UUID NOT NULL REFERENCES public.mai_talent_shows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, on_stage, performed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.mai_talent_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read queue" ON public.mai_talent_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow users to join queue" ON public.mai_talent_queue FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow judges/admins to update queue" ON public.mai_talent_queue FOR UPDATE TO authenticated USING (
  (SELECT is_judge FROM user_profiles WHERE id = auth.uid()) OR 
  (SELECT role = 'admin' FROM user_profiles WHERE id = auth.uid())
) WITH CHECK (
  (SELECT is_judge FROM user_profiles WHERE id = auth.uid()) OR 
  (SELECT role = 'admin' FROM user_profiles WHERE id = auth.uid())
);
