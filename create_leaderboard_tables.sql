-- Create table for User Boosts
CREATE TABLE IF NOT EXISTS user_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) NOT NULL,
  boost_percentage INT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for Family Boosts
CREATE TABLE IF NOT EXISTS family_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) NOT NULL,
  boost_percentage INT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RPC to get Top Gifters (Leaderboard)
CREATE OR REPLACE FUNCTION get_gifter_leaderboard(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  total_coins BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.user_id,
    up.username,
    up.avatar_url,
    SUM(ct.amount)::BIGINT as total_coins
  FROM coin_transactions ct
  JOIN user_profiles up ON ct.user_id = up.id
  WHERE ct.type IN ('gift', 'gift_sent', 'gift_send')
    AND ct.created_at >= p_start_date
    AND ct.created_at <= p_end_date
  GROUP BY ct.user_id, up.username, up.avatar_url
  ORDER BY total_coins DESC
  LIMIT p_limit;
END;
$$;

-- RPC to get Top Families (War Results)
CREATE OR REPLACE FUNCTION get_top_war_families(
  p_start_date TIMESTAMPTZ,
  p_limit INT DEFAULT 3
)
RETURNS TABLE (
  family_id UUID,
  family_name TEXT,
  total_points BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id as family_id,
    f.name as family_name,
    SUM(wr.points)::BIGINT as total_points
  FROM war_results wr
  JOIN families f ON wr.family_id = f.id
  WHERE wr.created_at >= p_start_date
  GROUP BY f.id, f.name
  ORDER BY total_points DESC
  LIMIT p_limit;
END;
$$;
