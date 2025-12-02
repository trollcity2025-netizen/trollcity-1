-- Storage Policy for Tax Forms Bucket
-- Run this AFTER creating the "tax_forms" bucket in Supabase Storage

-- Allow users to upload their own tax forms
CREATE POLICY "Users can upload own tax forms"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tax_forms' AND
  (storage.foldername(name))[1] = 'w9' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow users to read their own tax forms
CREATE POLICY "Users can read own tax forms"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tax_forms' AND
  (storage.foldername(name))[1] = 'w9' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow admins to read all tax forms
CREATE POLICY "Admins can read all tax forms"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tax_forms' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'troll_officer')
  )
);

-- Allow admins to delete tax forms (for cleanup)
CREATE POLICY "Admins can delete tax forms"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tax_forms' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'troll_officer')
  )
);

