-- Create platform_fees table
CREATE TABLE platform_fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  fee_amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add platform_fee_last_charged to user_profiles
ALTER TABLE user_profiles ADD COLUMN platform_fee_last_charged TIMESTAMP;

-- Grant permissions
GRANT ALL ON platform_fees TO authenticated;
GRANT SELECT ON platform_fees TO anon;