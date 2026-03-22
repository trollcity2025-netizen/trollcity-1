-- Create City Ads Storage Bucket
-- Run this in Supabase SQL Editor to fix the "bucket not found" error

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'city-ads',
  'city-ads',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (PostgreSQL doesn't support IF NOT EXISTS for CREATE POLICY)
DROP POLICY IF EXISTS "Public read access for city-ads" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload to city-ads" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update city-ads" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete city-ads" ON storage.objects;

-- Public read access - all users can view ad images
CREATE POLICY "Public read access for city-ads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'city-ads');

-- Admin/secretary insert access
CREATE POLICY "Admins can upload to city-ads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'city-ads' 
  AND (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR role = 'secretary')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.secretary_assignments
      WHERE secretary_id = auth.uid()
    )
  )
);

-- Admin/secretary update access
CREATE POLICY "Admins can update city-ads"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'city-ads'
  AND (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR role = 'secretary')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.secretary_assignments
      WHERE secretary_id = auth.uid()
    )
  )
);

-- Admin/secretary delete access
CREATE POLICY "Admins can delete city-ads"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'city-ads'
  AND (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR role = 'secretary')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.secretary_assignments
      WHERE secretary_id = auth.uid()
    )
  )
);

-- Verify bucket was created
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'city-ads';
