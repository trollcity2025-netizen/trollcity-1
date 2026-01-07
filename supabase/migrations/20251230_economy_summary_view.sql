-- Economy Summary View for Admin Dashboard
-- Aggregates key economy metrics into a single view

CREATE OR REPLACE VIEW economy_summary AS
WITH 
  -- Total coins in circulation (all user balances)
  coins_in_circulation AS (
    SELECT 
      COALESCE(SUM(troll_coins), 0) + COALESCE(SUM(troll_coins), 0) AS total
    FROM user_profiles
  ),
  
  -- Total gift coins spent (from gifts table)
  gift_coins_spent AS (
    SELECT 
      COALESCE(SUM(coins_spent), 0) AS total
    FROM gifts
  ),
  
  -- Total payouts processed (USD) - Aggregates from both payout_requests and cashout_requests
  payouts_processed AS (
    SELECT 
      COALESCE(SUM(total_usd), 0) AS total_usd
    FROM (
      SELECT cash_amount AS total_usd FROM payout_requests WHERE status IN ('paid', 'approved')
      UNION ALL
      SELECT (requested_coins * 0.01) AS total_usd FROM cashout_requests WHERE status IN ('fulfilled', 'paid')
    ) AS combined_paid
  ),
  
  -- Total pending payout requests (USD) - Aggregates from both tables
  pending_payouts AS (
    SELECT 
      COALESCE(SUM(total_usd), 0) AS total_usd
    FROM (
      SELECT cash_amount AS total_usd FROM payout_requests WHERE status = 'pending'
      UNION ALL
      SELECT (requested_coins * 0.01) AS total_usd FROM cashout_requests WHERE status = 'pending'
    ) AS combined_pending
  ),
  
  -- Total revenue from coin purchases (USD)
  revenue_summary AS (
    SELECT 
      COALESCE(SUM(platform_profit), 0) AS total_revenue
    FROM coin_transactions
    WHERE type = 'purchase'
  ),

  -- Total creator earned coins (from gift receipts)
  creator_earned AS (
    SELECT 
      COALESCE(SUM(amount), 0) AS total_coins
    FROM coin_transactions
    WHERE type IN ('gift_receive', 'gift')
      AND amount > 0
  ),
  
  -- Top earning broadcaster
  top_broadcaster AS (
    SELECT 
      p.username,
      COALESCE(SUM(ct.amount), 0) AS total_earned
    FROM user_profiles p
    LEFT JOIN coin_transactions ct ON ct.user_id = p.id
      AND ct.type IN ('gift_receive', 'gift')
      AND ct.amount > 0
    WHERE p.is_broadcaster = true
    GROUP BY p.id, p.username
    ORDER BY total_earned DESC
    LIMIT 1
  )

SELECT 
  (SELECT total FROM coins_in_circulation) AS total_coins_in_circulation,
  (SELECT total FROM gift_coins_spent) AS total_gift_coins_spent,
  (SELECT total_usd FROM payouts_processed) AS total_payouts_processed_usd,
  (SELECT total_usd FROM pending_payouts) AS total_pending_payouts_usd,
  (SELECT total_revenue FROM revenue_summary) AS total_revenue_usd,
  (SELECT total_coins FROM creator_earned) AS total_creator_earned_coins,
  (SELECT username FROM top_broadcaster) AS top_earning_broadcaster;

-- Grant access to authenticated users (admins will filter in app)
GRANT SELECT ON economy_summary TO authenticated;
