-- Payout Request System
-- Allows users to request cashouts and tracks payouts for tax purposes

-- Create payout_requests table
CREATE TABLE IF NOT EXISTS payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  amount_usd numeric(10,2) NOT NULL,
  requested_coins int NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES user_profiles(id),
  notes text,
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id ON payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created_at ON payout_requests(created_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_payout_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_payout_requests_updated_at') THEN
    CREATE TRIGGER set_payout_requests_updated_at
    BEFORE UPDATE ON payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_payout_requests_updated_at();
  END IF;
END $$;

-- Yearly payout view for tax tracking
CREATE OR REPLACE VIEW creator_yearly_payouts AS
SELECT
  user_id,
  DATE_PART('year', created_at)::int AS year,
  SUM(amount_usd) AS total_payout_usd,
  COUNT(*) AS payout_count
FROM payout_requests
WHERE status IN ('paid')
GROUP BY user_id, DATE_PART('year', created_at);

-- Creators over $600 threshold (IRS 1099 requirement)
CREATE OR REPLACE VIEW creators_over_600 AS
SELECT
  c.user_id,
  p.username,
  c.year,
  c.total_payout_usd,
  c.payout_count
FROM creator_yearly_payouts c
JOIN user_profiles p ON p.id = c.user_id
WHERE c.total_payout_usd >= 600
ORDER BY c.year DESC, c.total_payout_usd DESC;

-- Grant access
GRANT SELECT ON creator_yearly_payouts TO authenticated;
GRANT SELECT ON creators_over_600 TO authenticated;

