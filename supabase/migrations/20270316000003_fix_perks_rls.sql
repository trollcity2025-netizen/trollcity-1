-- Fix User Perks RLS to allow toggling
DROP POLICY IF EXISTS "Users can update their own perks" ON public.user_perks;

CREATE POLICY "Users can update their own perks" 
ON public.user_perks 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure Insert is also correct
DROP POLICY IF EXISTS "Users can insert their own perks" ON public.user_perks;

CREATE POLICY "Users can insert their own perks" 
ON public.user_perks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);
