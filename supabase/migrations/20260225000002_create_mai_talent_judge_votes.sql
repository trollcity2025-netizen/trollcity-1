
CREATE TABLE IF NOT EXISTS public.mai_talent_judge_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  show_id UUID NOT NULL REFERENCES public.mai_talent_shows(id) ON DELETE CASCADE,
  audition_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE, -- The user being voted on
  judge_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  vote TEXT NOT NULL, -- 'yes' or 'no'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(show_id, audition_id, judge_id) -- Ensures a judge can only vote once per audition per show
);

ALTER TABLE public.mai_talent_judge_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow judges/admins to see votes" ON public.mai_talent_judge_votes FOR SELECT TO authenticated USING (
  (SELECT is_judge FROM user_profiles WHERE id = auth.uid()) OR 
  (SELECT role = 'admin' FROM user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Allow judges to vote" ON public.mai_talent_judge_votes FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = judge_id AND
  (SELECT is_judge FROM user_profiles WHERE id = auth.uid())
);
