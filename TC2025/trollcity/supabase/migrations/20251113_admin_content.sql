-- Create table for admin-editable content
CREATE TABLE IF NOT EXISTS admin_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_name TEXT NOT NULL,
  field_name TEXT NOT NULL DEFAULT 'content',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(page_name, field_name, is_active)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_content_page_name ON admin_content(page_name);
CREATE INDEX IF NOT EXISTS idx_admin_content_active ON admin_content(is_active);

-- Enable RLS
ALTER TABLE admin_content ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view active content" ON admin_content
  FOR SELECT USING (is_active = true);

CREATE POLICY "Only admins can manage content" ON admin_content
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (profiles.is_admin = true OR profiles.role = 'admin')
    )
  );

-- Grant permissions
GRANT SELECT ON admin_content TO anon, authenticated;
GRANT ALL ON admin_content TO authenticated;

-- Create function to get latest content for a page
CREATE OR REPLACE FUNCTION get_admin_content(page_name_param TEXT, field_name_param TEXT DEFAULT 'content')
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT content 
    FROM admin_content 
    WHERE page_name = page_name_param 
    AND field_name = field_name_param 
    AND is_active = true
    ORDER BY updated_at DESC 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;