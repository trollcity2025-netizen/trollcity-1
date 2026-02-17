-- Create missing stream gift functions
-- Note: stream_gifts table references gifts table which has the cost column

-- Function to get total gift coins for a stream
CREATE OR REPLACE FUNCTION public.get_stream_gift_total(p_stream_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(g.cost), 0)::bigint AS total_coins
  FROM public.stream_gifts sg
  JOIN public.gifts g ON g.id = sg.gift_id
  WHERE sg.stream_id = p_stream_id;
$$;

-- Function to get gift leaderboard for a stream
CREATE OR REPLACE FUNCTION public.get_stream_gift_leaderboard(p_stream_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE(
  sender_id uuid,
  total_coins bigint,
  gift_count bigint,
  last_gift_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sg.sender_id,
    SUM(g.cost)::bigint AS total_coins,
    COUNT(*)::bigint AS gift_count,
    MAX(sg.created_at) AS last_gift_at
  FROM public.stream_gifts sg
  JOIN public.gifts g ON g.id = sg.gift_id
  WHERE sg.stream_id = p_stream_id
  GROUP BY sg.sender_id
  ORDER BY total_coins DESC
  LIMIT p_limit;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_stream_gift_total(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stream_gift_total(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_stream_gift_leaderboard(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stream_gift_leaderboard(uuid, integer) TO anon;