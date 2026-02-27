-- Add cover_url column to profiles table for cover photo feature
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Ensure the covers bucket exists and is public (in case migration wasn't applied)
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create RLS policy for users to upload their own cover photos
-- Users can only upload to their own folder: covers/{userId}/
CREATE POLICY IF NOT EXISTS "Users can upload their own cover photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'covers' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own cover photos
CREATE POLICY IF NOT EXISTS "Users can update their own cover photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'covers' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own cover photos
CREATE POLICY IF NOT EXISTS "Users can delete their own cover photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'covers' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Anyone can view cover photos (public bucket)
CREATE POLICY IF NOT EXISTS "Anyone can view cover photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'covers');

-- Allow public access to covers bucket
CREATE POLICY IF NOT EXISTS "Public access to covers"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'covers');
