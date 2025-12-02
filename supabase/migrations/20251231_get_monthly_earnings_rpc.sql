-- RPC Function: get_monthly_earnings
-- Returns monthly earnings breakdown for a specific user

CREATE OR REPLACE FUNCTION get_monthly_earnings(p_user_id uuid)
RETURNS TABLE (
  month text,
  coins_earned_from_gifts bigint,
  gift_count bigint,
  unique_gifters bigint,
  paid_coins_earned bigint,
  free_coins_earned bigint,
  usd_equivalent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(DATE_TRUNC('month', g.created_at), 'YYYY-MM') AS month,
    SUM(g.coins_spent)::bigint AS coins_earned_from_gifts,
    COUNT(DISTINCT g.id)::bigint AS gift_count,
    COUNT(DISTINCT g.sender_id)::bigint AS unique_gifters,
    SUM(CASE WHEN g.gift_type = 'paid' THEN g.coins_spent ELSE 0 END)::bigint AS paid_coins_earned,
    SUM(CASE WHEN g.gift_type = 'free' THEN g.coins_spent ELSE 0 END)::bigint AS free_coins_earned,
    (SUM(g.coins_spent)::numeric / 100.0) AS usd_equivalent
  FROM gifts g
  WHERE g.receiver_id = p_user_id
  GROUP BY DATE_TRUNC('month', g.created_at)
  ORDER BY DATE_TRUNC('month', g.created_at) DESC
  LIMIT 12;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_monthly_earnings(uuid) TO authenticated;

