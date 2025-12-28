-- Create troll_posts table for Troll City Wall
CREATE TABLE IF NOT EXISTS public.troll_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  coins_earned INTEGER DEFAULT 0 CHECK (coins_earned >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.troll_posts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view troll posts" ON public.troll_posts FOR SELECT USING (true);

CREATE POLICY "Users can insert their own posts" ON public.troll_posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON public.troll_posts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON public.troll_posts FOR DELETE
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_troll_posts_user_id ON public.troll_posts(user_id);
CREATE INDEX idx_troll_posts_created_at ON public.troll_posts(created_at);

-- Create storage bucket for post images
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for post images
CREATE POLICY "Anyone can view post images" ON storage.objects
FOR SELECT USING (bucket_id = 'post-images');

CREATE POLICY "Authenticated users can upload post images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'post-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own post images" ON storage.objects
FOR UPDATE USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own post images" ON storage.objects
FOR DELETE USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);