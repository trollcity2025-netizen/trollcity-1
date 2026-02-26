ALTER TABLE public.mai_talent_votes ADD COLUMN show_id UUID REFERENCES public.mai_talent_shows(id) ON DELETE CASCADE;
