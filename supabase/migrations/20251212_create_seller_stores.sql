-- Create stores table for seller management
CREATE TABLE IF NOT EXISTS stores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);

-- Enable RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Store owners can view their own stores
CREATE POLICY "Store owners can view own stores" ON stores
    FOR SELECT USING (auth.uid() = owner_id);

-- Store owners can update their own stores
CREATE POLICY "Store owners can update own stores" ON stores
    FOR UPDATE USING (auth.uid() = owner_id);

-- Admins can view all stores
CREATE POLICY "Admins can view all stores" ON stores
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'officer')
        )
    );

-- Prevent duplicate stores per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_unique_owner ON stores(owner_id) WHERE status = 'active';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_stores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION update_stores_updated_at();