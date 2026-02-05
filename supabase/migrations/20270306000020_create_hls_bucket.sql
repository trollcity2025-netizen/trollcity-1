-- Create storage bucket for HLS streams
INSERT INTO storage.buckets (id, name, public)
VALUES ('hls', 'hls', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "HLS streams are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload HLS" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload HLS" ON storage.objects;

-- Policy: Public can view HLS files
CREATE POLICY "HLS streams are publicly accessible"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'hls' );

-- Policy: Service role (or anyone with S3 keys) can upload
-- Note: S3 API usage typically bypasses RLS if using admin keys, but good to have explicit policy for service role client
CREATE POLICY "Service role can upload HLS"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK ( bucket_id = 'hls' );

-- Allow authenticated users (broadcasters) to potentially upload if needed (though usually handled by server)
CREATE POLICY "Authenticated users can upload HLS"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK ( bucket_id = 'hls' );
