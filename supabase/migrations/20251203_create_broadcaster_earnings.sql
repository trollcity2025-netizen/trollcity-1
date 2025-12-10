-- Broadcaster Earnings Table Migration
-- Creates table for tracking broadcaster earnings from gifts

CREATE TABLE IF NOT EXISTS broadcaster_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID REFERENCES user_profiles(id),
  gift_id UUID,
  coins_received INTEGER NOT NULL,
  usd_value NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_broadcaster_earnings_broadcaster_id ON broadcaster_earnings(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_broadcaster_earnings_gift_id ON broadcaster_earnings(gift_id);
CREATE INDEX IF NOT EXISTS idx_broadcaster_earnings_created_at ON broadcaster_earnings(created_at);

-- Create RLS policies
ALTER TABLE broadcaster_earnings ENABLE ROW LEVEL SECURITY;

-- Broadcasters can view their own earnings
CREATE POLICY "Broadcasters can view their own earnings"
  ON broadcaster_earnings FOR SELECT
  USING (broadcaster_id = auth.uid());

-- Officers and admins can view all earnings
CREATE POLICY "Officers can view all earnings"
  ON broadcaster_earnings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_officer = true OR role = 'admin' OR is_admin = true)
    )
  );

-- Officers and admins can manage earnings
CREATE POLICY "Officers can manage earnings"
  ON broadcaster_earnings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND (is_officer = true OR role = 'admin' OR is_admin = true)
    )
  );

-- Create a trigger to automatically populate broadcaster_earnings when gifts are received
CREATE OR REPLACE FUNCTION track_broadcaster_earnings()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate USD value (assuming 100 coins = $1)
  INSERT INTO broadcaster_earnings (
    broadcaster_id,
    gift_id,
    coins_received,
    usd_value,
    created_at
  ) VALUES (
    NEW.receiver_id,
    NEW.id,
    NEW.coins_spent,
    NEW.coins_spent / 100.0,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on gifts table
CREATE TRIGGER tr_track_broadcaster_earnings
AFTER INSERT ON gifts
FOR EACH ROW
EXECUTE FUNCTION track_broadcaster_earnings();