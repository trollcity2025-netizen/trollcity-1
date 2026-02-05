-- Create storage bucket for verification documents (Private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification_docs', 'verification_docs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload verification docs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view verification docs" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access verification" ON storage.objects;

-- Policy: Authenticated users can upload their own verification docs
CREATE POLICY "Users can upload verification docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK ( bucket_id = 'verification_docs' AND auth.uid() = owner );

-- Policy: Admins can view (Select)
CREATE POLICY "Admins can view verification docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verification_docs' 
    AND EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin')
    )
  );

-- Policy: Service role full access
CREATE POLICY "Service role full access verification"
  ON storage.objects
  FOR ALL
  TO service_role
  USING ( bucket_id = 'verification_docs' )
  WITH CHECK ( bucket_id = 'verification_docs' );
