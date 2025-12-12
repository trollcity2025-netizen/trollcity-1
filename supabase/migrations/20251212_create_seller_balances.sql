-- Create seller_balances table for seller payout management
CREATE TABLE IF NOT EXISTS seller_balances (
    seller_id uuid PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    available_coins bigint DEFAULT 0 NOT NULL CHECK (available_coins >= 0),
    pending_coins bigint DEFAULT 0 NOT NULL CHECK (pending_coins >= 0),
    total_earned_coins bigint DEFAULT 0 NOT NULL CHECK (total_earned_coins >= 0),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_seller_balances_available_coins ON seller_balances(available_coins) WHERE available_coins > 0;
CREATE INDEX IF NOT EXISTS idx_seller_balances_pending_coins ON seller_balances(pending_coins) WHERE pending_coins > 0;

-- Enable RLS
ALTER TABLE seller_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Sellers can view their own balances
CREATE POLICY "Sellers can view own balances" ON seller_balances
    FOR SELECT USING (auth.uid() = seller_id);

-- Admins can view all balances
CREATE POLICY "Admins can view all balances" ON seller_balances
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'officer')
        )
    );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_seller_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_seller_balances_updated_at
    BEFORE UPDATE ON seller_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_seller_balances_updated_at();

-- Function to initialize seller balance when store is created
CREATE OR REPLACE FUNCTION initialize_seller_balance()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO seller_balances (seller_id)
    VALUES (NEW.owner_id)
    ON CONFLICT (seller_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-initialize seller balance when store is created
CREATE TRIGGER trigger_initialize_seller_balance
    AFTER INSERT ON stores
    FOR EACH ROW
    EXECUTE FUNCTION initialize_seller_balance();