-- Allow admins and troll officers to delete any post on Troll City Wall

-- Drop existing delete policy
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.troll_posts;

-- Recreate policy for users to delete their own posts
CREATE POLICY "Users can delete their own posts" ON public.troll_posts FOR DELETE
USING (auth.uid() = user_id);

-- Add policy for admins and troll officers to delete any post
CREATE POLICY "Admins and officers can delete any post" ON public.troll_posts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('admin', 'troll_officer')
  )
);

