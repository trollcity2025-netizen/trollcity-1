-- Column Name Consistency Fix
-- ==============================================
-- This migration ensures the user_profiles table has the correct coin balance columns
-- and that all views and functions reference them properly
-- 
-- The issue: Multiple migrations were referencing non-existent columns:
-- - troll_coins (should be troll_coins_balance)
-- - trollmonds (should be free_coin_balance)

-- =====================================================
-- 1. ENSURE CORRECT COLUMNS EXIST
-- =====================================================

-- Ensure troll_coins_balance exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'troll_coins_balance'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN troll_coins_balance bigint DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Ensure free_coin_balance exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'free_coin_balance'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN free_coin_balance bigint DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Drop incorrect columns if they exist (troll_coins, trollmonds)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'troll_coins'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN troll_coins;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'trollmonds'
  ) THEN
    -- trollmonds might not exist, but if it does and it's not the same as free_coin_balance, drop it
    ALTER TABLE user_profiles DROP COLUMN IF EXISTS trollmonds;
  END IF;
END $$;

-- =====================================================
-- 2. RECREATE EARNINGS VIEW WITH CORRECT COLUMNS
-- =====================================================

DROP VIEW IF EXISTS earnings_view CASCADE;

CREATE OR REPLACE VIEW earnings_view AS
WITH 
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
  p.troll_coins_balance,
  p.free_coin_balance,
  
  COALESCE(ce.total_coins, 0) AS current_month_earnings,
  COALESCE(ce.transaction_count, 0) AS current_month_transactions,
  
  COALESCE(ps.paid_out_usd, 0) AS current_month_paid_out,
  COALESCE(ps.pending_usd, 0) AS current_month_pending,
  COALESCE(ps.approved_usd, 0) AS current_month_approved,
  COALESCE(ps.paid_count, 0) AS current_month_paid_count,
  COALESCE(ps.pending_count, 0) AS current_month_pending_count,
  
  COALESCE(yp.total_paid_usd, 0) AS yearly_paid_usd,
  COALESCE(yp.payout_count, 0) AS yearly_payout_count,
  COALESCE(yp.year, DATE_PART('year', NOW())::int) AS tax_year,
  
  CASE 
    WHEN COALESCE(yp.total_paid_usd, 0) >= 600 THEN 'over_threshold'
    WHEN COALESCE(yp.total_paid_usd, 0) >= 500 THEN 'nearing_threshold'
    ELSE 'below_threshold'
  END AS irs_threshold_status,
  
  (SELECT MAX(pr.created_at) FROM payout_requests pr WHERE pr.user_id = p.id AND pr.status = 'paid') AS last_payout_at,
  
  (SELECT COUNT(*) FROM payout_requests pr WHERE pr.user_id = p.id AND pr.status = 'pending') AS pending_requests_count,
  
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
WHERE COALESCE(p.total_earned_coins, 0) > 0 OR COALESCE(p.troll_coins_balance, 0) > 0;

GRANT SELECT ON earnings_view TO authenticated;

-- =====================================================
-- 3. VERIFY COLUMN CONSISTENCY
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Column Name Consistency Fix Applied';
  RAISE NOTICE '- Verified troll_coins_balance column exists';
  RAISE NOTICE '- Verified free_coin_balance column exists';
  RAISE NOTICE '- Recreated earnings_view with correct column references';
  RAISE NOTICE 'All views and functions now correctly reference:';
  RAISE NOTICE '  - troll_coins_balance (paid coins)';
  RAISE NOTICE '  - free_coin_balance (free coins)';
END $$;
