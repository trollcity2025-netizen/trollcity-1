
-- Allow users to delete their own pitches
CREATE POLICY "Users can delete own pitches" ON public.pitches FOR DELETE
USING (auth.uid() = user_id);
