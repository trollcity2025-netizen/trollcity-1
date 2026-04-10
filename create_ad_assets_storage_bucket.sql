-- Create Ad Assets Storage Bucket for X Ads System
-- Run this in Supabase SQL Editor to fix the "bucket not found" error for X Ads

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ad-assets',
  'ad-assets',
  true,
  10485760, -- 10MB limit for higher quality images
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for ad-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload to ad-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update ad-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete ad-assets" ON storage.objects;

-- Public read access - all users can view ad images
CREATE POLICY "Public read access for ad-assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'ad-assets');

-- Admin/secretary insert access
CREATE POLICY "Admins can upload to ad-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ad-assets' 
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
CREATE POLICY "Admins can update ad-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ad-assets'
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
CREATE POLICY "Admins can delete ad-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ad-assets'
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
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'ad-assets';

-- If not found, check what buckets exist
-- SELECT id, name FROM storage.buckets;
