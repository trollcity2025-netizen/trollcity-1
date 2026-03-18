-- Add featured broadcast columns to streams table
ALTER TABLE streams 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS featured_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS featured_by UUID REFERENCES auth.users(id);

-- Create index for featured streams queries
CREATE INDEX IF NOT EXISTS idx_streams_featured ON streams(is_featured, status) WHERE is_featured = true;

-- Add RLS policy for featured streams
DROP POLICY IF EXISTS "Anyone can view featured streams" ON streams;
CREATE POLICY "Anyone can view featured streams" ON streams
FOR SELECT USING (is_featured = true OR status = 'live');

-- Grant permissions
GRANT SELECT ON streams TO anon, authenticated;
GRANT UPDATE (is_featured, featured_at, featured_by) ON streams TO authenticated;
