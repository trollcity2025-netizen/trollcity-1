-- Migration: Create fees table for admin fee management
-- Description: Stores custom fees that can be managed by admins

-- Create fee_categories table first
CREATE TABLE IF NOT EXISTS fee_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6B7280',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default fee categories
INSERT INTO fee_categories (name, description, color) VALUES
  ('platform', 'Core platform fees', '#8B5CF6'),
  ('stream', 'Stream-related fees', '#10B981'),
  ('premium', 'Premium feature fees', '#F59E0B'),
  ('custom', 'Custom user-defined fees', '#6B7280')
ON CONFLICT (name) DO NOTHING;

-- Create fees table
CREATE TABLE IF NOT EXISTS fees (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  category VARCHAR(50) NOT NULL DEFAULT 'custom',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_fees_category ON fees(category);
CREATE INDEX IF NOT EXISTS idx_fees_code ON fees(code);
CREATE INDEX IF NOT EXISTS idx_fees_active ON fees(is_active);

-- Enable RLS
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for fees table
CREATE POLICY "Admins can view all fees" ON fees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR is_admin = true)
    )
  );

CREATE POLICY "Admins can insert fees" ON fees
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR is_admin = true)
    )
  );

CREATE POLICY "Admins can update fees" ON fees
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR is_admin = true)
    )
  );

CREATE POLICY "Admins can delete fees" ON fees
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR is_admin = true)
    )
  );

-- Create policies for fee_categories table
CREATE POLICY "Admins can view fee categories" ON fee_categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR is_admin = true)
    )
  );

CREATE POLICY "Admins can manage fee categories" ON fee_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR is_admin = true)
    )
  );

-- Grant permissions
GRANT SELECT ON fee_categories TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fees TO anon, authenticated;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_fee_categories_updated_at
  BEFORE UPDATE ON fee_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fees_updated_at
  BEFORE UPDATE ON fees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();