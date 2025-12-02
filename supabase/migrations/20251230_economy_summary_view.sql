-- Economy Summary View for Admin Dashboard
-- Aggregates key economy metrics into a single view

CREATE OR REPLACE VIEW economy_summary AS
WITH 
  -- Total coins in circulation (all user balances)
  coins_in_circulation AS (
    SELECT 
      COALESCE(SUM(paid_coin_balance), 0) + COALESCE(SUM(free_coin_balance), 0) AS total
    FROM user_profiles
  ),
  
  -- Total gift coins spent (from gifts table)
  gift_coins_spent AS (
    SELECT 
      COALESCE(SUM(coins_spent), 0) AS total
    FROM gifts
  ),
  
  -- Total payouts processed (USD)
  payouts_processed AS (
    SELECT 
      COALESCE(SUM(cash_amount), 0) AS total_usd
    FROM payout_requests
    WHERE status = 'paid' OR status = 'approved'
  ),
  
  -- Total pending payout requests (USD)
  pending_payouts AS (
    SELECT 
      COALESCE(SUM(cash_amount), 0) AS total_usd
    FROM payout_requests
    WHERE status = 'pending'
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
  (SELECT total_coins FROM creator_earned) AS total_creator_earned_coins,
  (SELECT username FROM top_broadcaster) AS top_earning_broadcaster;

-- Grant access to authenticated users (admins will filter in app)
GRANT SELECT ON economy_summary TO authenticated;

