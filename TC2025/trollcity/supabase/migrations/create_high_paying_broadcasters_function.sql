-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_current_high_paying_broadcasters();

-- Create RPC function to get current high paying broadcasters
CREATE OR REPLACE FUNCTION get_current_high_paying_broadcasters()
RETURNS TABLE (
  id UUID,
  username TEXT,
  total_revenue NUMERIC,
  stream_count BIGINT,
  avg_revenue_per_stream NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    COALESCE(SUM(coin_transactions.amount), 0) as total_revenue,
    COUNT(DISTINCT streams.id) as stream_count,
    CASE 
      WHEN COUNT(DISTINCT streams.id) > 0 
      THEN COALESCE(SUM(coin_transactions.amount), 0) / COUNT(DISTINCT streams.id)
      ELSE 0
    END as avg_revenue_per_stream
  FROM profiles p
  LEFT JOIN streams ON streams.streamer_id = p.id AND streams.is_live = true
  LEFT JOIN coin_transactions ON coin_transactions.user_id = p.id 
    AND coin_transactions.transaction_type = 'gift_received'
    AND coin_transactions.created_at >= NOW() - INTERVAL '24 hours'
  WHERE p.is_active = true
    AND p.is_banned != true
  GROUP BY p.id, p.username
  HAVING COALESCE(SUM(coin_transactions.amount), 0) > 0
  ORDER BY total_revenue DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;