
-- Stream Messages
CREATE TABLE IF NOT EXISTS public.stream_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stream_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stream messages are viewable by everyone" ON public.stream_messages FOR SELECT USING (true);
CREATE POLICY "Users can insert their own messages" ON public.stream_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
