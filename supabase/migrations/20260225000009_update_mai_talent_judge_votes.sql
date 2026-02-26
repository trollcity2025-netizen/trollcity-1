ALTER TABLE public.mai_talent_judge_votes ADD COLUMN golden_buzzer BOOLEAN DEFAULT false;
ALTER TABLE public.mai_talent_judge_votes RENAME COLUMN audition_id TO contestant_id;
