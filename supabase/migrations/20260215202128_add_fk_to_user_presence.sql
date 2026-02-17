
ALTER TABLE public.user_presence
ADD CONSTRAINT fk_user_id
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
