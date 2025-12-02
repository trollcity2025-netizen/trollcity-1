-- Comprehensive Earnings System
-- Ensures payout_requests table has correct structure and creates earnings views

-- Ensure payout_requests table has all required columns
DO $$
BEGIN
  -- Add cash_amount if it doesn't exist (some migrations use amount_usd)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'cash_amount'
  ) THEN
    -- Check if amount_usd exists and migrate data
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'payout_requests' AND column_name = 'amount_usd'
    ) THEN
      ALTER TABLE payout_requests 
        ADD COLUMN cash_amount numeric(10,2);
      UPDATE payout_requests 
        SET cash_amount = amount_usd 
        WHERE cash_amount IS NULL;
    ELSE
      ALTER TABLE payout_requests 
        ADD COLUMN cash_amount numeric(10,2);
    END IF;
  END IF;

  -- Add coins_redeemed if it doesn't exist (some migrations use requested_coins or coin_amount)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'coins_redeemed'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'payout_requests' AND column_name = 'requested_coins'
    ) THEN
      ALTER TABLE payout_requests 
        ADD COLUMN coins_redeemed bigint;
      UPDATE payout_requests 
        SET coins_redeemed = requested_coins 
        WHERE coins_redeemed IS NULL;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'payout_requests' AND column_name = 'coin_amount'
    ) THEN
      ALTER TABLE payout_requests 
        ADD COLUMN coins_redeemed bigint;
      UPDATE payout_requests 
        SET coins_redeemed = coin_amount 
        WHERE coins_redeemed IS NULL;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'payout_requests' AND column_name = 'coins_used'
    ) THEN
      ALTER TABLE payout_requests 
        ADD COLUMN coins_redeemed bigint;
      UPDATE payout_requests 
        SET coins_redeemed = coins_used 
        WHERE coins_redeemed IS NULL;
    ELSE
      ALTER TABLE payout_requests 
        ADD COLUMN coins_redeemed bigint;
    END IF;
  END IF;

  -- Add admin_id if it doesn't exist (some migrations use processed_by)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payout_requests' AND column_name = 'admin_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'payout_requests' AND column_name = 'processed_by'
    ) THEN
      ALTER TABLE payout_requests 
        ADD COLUMN admin_id uuid REFERENCES user_profiles(id);
      UPDATE payout_requests 
        SET admin_id = processed_by 
        WHERE admin_id IS NULL;
    ELSE
      ALTER TABLE payout_requests 
        ADD COLUMN admin_id uuid REFERENCES user_profiles(id);
    END IF;
  END IF;

  -- Ensure status constraint is correct (drop and recreate if needed)
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'payout_requests_status_check'
  ) THEN
    ALTER TABLE payout_requests DROP CONSTRAINT IF EXISTS payout_requests_status_check;
  END IF;
  
  ALTER TABLE payout_requests 
    ADD CONSTRAINT payout_requests_status_check 
    CHECK (status IN ('pending', 'approved', 'paid', 'rejected'));
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id ON payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created_at ON payout_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_status ON payout_requests(user_id, status);

-- ============================================
-- EARNINGS VIEW - Comprehensive earnings summary
-- ============================================
CREATE OR REPLACE VIEW earnings_view AS
WITH 
  -- Calculate earnings from gifts (coins received)
  gift_earnings AS (
    SELECT 
      receiver_id AS user_id,
      SUM(coins_spent) AS total_coins_earned,
      COUNT(*) AS gift_count,
      DATE_TRUNC('month', created_at) AS month
    FROM gifts
    WHERE receiver_id IS NOT NULL
    GROUP BY receiver_id, DATE_TRUNC('month', created_at)
  ),
  
  -- Calculate earnings from coin_transactions (gift_receive type)
  transaction_earnings AS (
    SELECT 
      user_id,
      SUM(amount) AS total_coins_earned,
      COUNT(*) AS transaction_count,
      DATE_TRUNC('month', created_at) AS month
    FROM coin_transactions
    WHERE type IN ('gift_receive', 'gift') 
      AND amount > 0
    GROUP BY user_id, DATE_TRUNC('month', created_at)
  ),
  
  -- Combine earnings sources
  combined_earnings AS (
    SELECT 
      COALESCE(g.user_id, t.user_id) AS user_id,
      COALESCE(g.month, t.month) AS month,
      COALESCE(g.total_coins_earned, 0) + COALESCE(t.total_coins_earned, 0) AS total_coins,
      COALESCE(g.gift_count, 0) + COALESCE(t.transaction_count, 0) AS transaction_count
    FROM gift_earnings g
    FULL OUTER JOIN transaction_earnings t 
      ON g.user_id = t.user_id AND g.month = t.month
  ),
  
  -- Calculate payouts
  payout_summary AS (
    SELECT 
      user_id,
      DATE_TRUNC('month', created_at) AS month,
      SUM(CASE WHEN status = 'paid' THEN COALESCE(cash_amount, amount_usd, 0) ELSE 0 END) AS paid_out_usd,
      SUM(CASE WHEN status = 'pending' THEN COALESCE(cash_amount, amount_usd, 0) ELSE 0 END) AS pending_usd,
      SUM(CASE WHEN status = 'approved' THEN COALESCE(cash_amount, amount_usd, 0) ELSE 0 END) AS approved_usd,
      SUM(CASE WHEN status = 'rejected' THEN COALESCE(cash_amount, amount_usd, 0) ELSE 0 END) AS rejected_usd,
      COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
      COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count
    FROM payout_requests
    GROUP BY user_id, DATE_TRUNC('month', created_at)
  ),
  
  -- Yearly payout totals for IRS threshold
  yearly_payouts AS (
    SELECT 
      user_id,
      DATE_PART('year', created_at)::int AS year,
      SUM(COALESCE(cash_amount, amount_usd, 0)) AS total_paid_usd,
      COUNT(*) AS payout_count
    FROM payout_requests
    WHERE status = 'paid'
    GROUP BY user_id, DATE_PART('year', created_at)
  )

SELECT 
  p.id,
  p.username,
  p.total_earned_coins,
  p.paid_coin_balance,
  p.free_coin_balance,
  
  -- Current month earnings
  COALESCE(ce.total_coins, 0) AS current_month_earnings,
  COALESCE(ce.transaction_count, 0) AS current_month_transactions,
  
  -- Payout summary
  COALESCE(ps.paid_out_usd, 0) AS current_month_paid_out,
  COALESCE(ps.pending_usd, 0) AS current_month_pending,
  COALESCE(ps.approved_usd, 0) AS current_month_approved,
  COALESCE(ps.paid_count, 0) AS current_month_paid_count,
  COALESCE(ps.pending_count, 0) AS current_month_pending_count,
  
  -- Yearly totals for IRS threshold
  COALESCE(yp.total_paid_usd, 0) AS yearly_paid_usd,
  COALESCE(yp.payout_count, 0) AS yearly_payout_count,
  COALESCE(yp.year, DATE_PART('year', NOW())::int) AS tax_year,
  
  -- IRS threshold status
  CASE 
    WHEN COALESCE(yp.total_paid_usd, 0) >= 600 THEN 'over_threshold'
    WHEN COALESCE(yp.total_paid_usd, 0) >= 500 THEN 'nearing_threshold'
    ELSE 'below_threshold'
  END AS irs_threshold_status,
  
  -- Last payout date
  (SELECT MAX(pr.created_at) FROM payout_requests pr WHERE pr.user_id = p.id AND pr.status = 'paid') AS last_payout_at,
  
  -- Pending payout requests count
  (SELECT COUNT(*) FROM payout_requests pr WHERE pr.user_id = p.id AND pr.status = 'pending') AS pending_requests_count,
  
  -- Total lifetime payouts
  (SELECT SUM(COALESCE(pr.cash_amount, pr.amount_usd, 0)) FROM payout_requests pr WHERE pr.user_id = p.id AND pr.status = 'paid') AS lifetime_paid_usd

FROM user_profiles p
LEFT JOIN combined_earnings ce 
  ON ce.user_id = p.id 
  AND ce.month = DATE_TRUNC('month', NOW())
LEFT JOIN payout_summary ps 
  ON ps.user_id = p.id 
  AND ps.month = DATE_TRUNC('month', NOW())
LEFT JOIN yearly_payouts yp 
  ON yp.user_id = p.id 
  AND yp.year = DATE_PART('year', NOW())::int
WHERE p.is_broadcaster = true OR p.total_earned_coins > 0;

-- Grant access
GRANT SELECT ON earnings_view TO authenticated;

-- ============================================
-- MONTHLY EARNINGS BREAKDOWN VIEW
-- ============================================
CREATE OR REPLACE VIEW monthly_earnings_breakdown AS
SELECT 
  p.id AS user_id,
  p.username,
  DATE_TRUNC('month', g.created_at) AS month,
  SUM(g.coins_spent) AS coins_earned_from_gifts,
  COUNT(DISTINCT g.id) AS gift_count,
  COUNT(DISTINCT g.sender_id) AS unique_gifters,
  SUM(CASE WHEN g.gift_type = 'paid' THEN g.coins_spent ELSE 0 END) AS paid_coins_earned,
  SUM(CASE WHEN g.gift_type = 'free' THEN g.coins_spent ELSE 0 END) AS free_coins_earned
FROM user_profiles p
JOIN gifts g ON g.receiver_id = p.id
WHERE p.is_broadcaster = true OR p.total_earned_coins > 0
GROUP BY p.id, p.username, DATE_TRUNC('month', g.created_at)
ORDER BY month DESC, coins_earned_from_gifts DESC;

GRANT SELECT ON monthly_earnings_breakdown TO authenticated;

-- ============================================
-- PAYOUT HISTORY VIEW
-- ============================================
CREATE OR REPLACE VIEW payout_history_view AS
SELECT 
  pr.id,
  pr.user_id,
  p.username,
  COALESCE(pr.cash_amount, 0) AS cash_amount,
  COALESCE(pr.coins_redeemed, pr.requested_coins, pr.coin_amount, pr.coins_used, 0) AS coins_redeemed,
  pr.status,
  pr.created_at,
  pr.processed_at,
  pr.admin_id,
  admin_p.username AS admin_username,
  pr.notes,
  -- Calculate USD equivalent (assuming 100 coins = $1)
  CASE 
    WHEN COALESCE(pr.cash_amount, 0) > 0 THEN pr.cash_amount
    ELSE (COALESCE(pr.coins_redeemed, pr.requested_coins, pr.coin_amount, pr.coins_used, 0)::numeric / 100.0)
  END AS usd_equivalent
FROM payout_requests pr
JOIN user_profiles p ON p.id = pr.user_id
LEFT JOIN user_profiles admin_p ON admin_p.id = pr.admin_id
ORDER BY pr.created_at DESC;

GRANT SELECT ON payout_history_view TO authenticated;

-- ============================================
-- IRS THRESHOLD TRACKING VIEW
-- ============================================
CREATE OR REPLACE VIEW irs_threshold_tracking AS
SELECT 
  p.id AS user_id,
  p.username,
  DATE_PART('year', pr.created_at)::int AS year,
  SUM(COALESCE(pr.cash_amount, pr.amount_usd, 0)) AS total_paid_usd,
  COUNT(*) AS payout_count,
  CASE 
    WHEN SUM(COALESCE(pr.cash_amount, pr.amount_usd, 0)) >= 600 THEN true
    ELSE false
  END AS requires_1099,
  CASE 
    WHEN SUM(COALESCE(pr.cash_amount, pr.amount_usd, 0)) >= 600 THEN 'REQUIRED'
    WHEN SUM(COALESCE(pr.cash_amount, pr.amount_usd, 0)) >= 500 THEN 'WARNING'
    ELSE 'OK'
  END AS threshold_status,
  MAX(pr.created_at) AS last_payout_date
FROM user_profiles p
JOIN payout_requests pr ON pr.user_id = p.id
WHERE pr.status = 'paid'
GROUP BY p.id, p.username, DATE_PART('year', pr.created_at)
ORDER BY year DESC, total_paid_usd DESC;

GRANT SELECT ON irs_threshold_tracking TO authenticated;

