-- Creator Analytics System
-- Migration: creator_analytics_system.sql
-- Creates comprehensive analytics RPCs for creator dashboard

-- 1. Create gift_ledger view that combines existing gifts table with analytics data
-- This view adapts the existing gifts table to work with the analytics RPCs
CREATE OR REPLACE VIEW gift_ledger AS
SELECT 
  id,
  sender_id,
  receiver_id,
  coins_spent as coins,
  CASE 
    WHEN battle_id IS NOT NULL THEN true 
    ELSE false 
  END as is_battle,
  CASE 
    WHEN message ILIKE '%event%' THEN true 
    ELSE false 
  END as is_event,
  COALESCE(gift_type, 'gift') as source,
  created_at
FROM gifts
WHERE receiver_id IS NOT NULL;

-- Enable RLS on the view (inherits from underlying table)
ALTER VIEW gift_ledger SET (security_barrier = true);

-- 2. RPC: Overall earnings overview
CREATE OR REPLACE FUNCTION public.get_earnings_overview()
RETURNS TABLE (
  total_coins_earned bigint,
  total_bonus_coins bigint,
  total_payouts_usd numeric,
  pending_payouts_usd numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH base AS (
    SELECT
      COALESCE(SUM(gl.coins), 0) as total_coins
    FROM gift_ledger gl
    WHERE gl.receiver_id = auth.uid()
  ),
  bonus AS (
    SELECT
      COALESCE(SUM(tbl.bonus_amount), 0) as total_bonus
    FROM trolltract_bonus_log tbl
    WHERE tbl.user_id = auth.uid()
  ),
  payouts AS (
    SELECT
      COALESCE(SUM(CASE WHEN status IN ('paid', 'approved') THEN COALESCE(cash_amount, amount_usd, 0) ELSE 0 END), 0) as paid,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN COALESCE(cash_amount, amount_usd, 0) ELSE 0 END), 0) as pending
    FROM payout_requests
    WHERE user_id = auth.uid()
  )
  SELECT
    base.total_coins      as total_coins_earned,
    bonus.total_bonus     as total_bonus_coins,
    payouts.paid          as total_payouts_usd,
    payouts.pending       as pending_payouts_usd
  FROM base, bonus, payouts;
$$;

GRANT EXECUTE ON FUNCTION public.get_earnings_overview() TO authenticated;

-- 3. RPC: Daily earnings series (last 30 days)
CREATE OR REPLACE FUNCTION public.get_daily_earnings_series(days_back integer DEFAULT 30)
RETURNS TABLE (
  day date,
  coins bigint,
  bonus_coins bigint,
  payouts_usd numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH days AS (
    SELECT generate_series(
      (current_date - (days_back::int - 1))::date,
      current_date,
      interval '1 day'
    )::date as d
  ),
  gifts AS (
    SELECT
      date(created_at) as d,
      SUM(coins)       as coins
    FROM gift_ledger
    WHERE receiver_id = auth.uid()
    GROUP BY 1
  ),
  bonus AS (
    SELECT
      date(created_at) as d,
      SUM(bonus_amount) as bonus
    FROM trolltract_bonus_log
    WHERE user_id = auth.uid()
    GROUP BY 1
  ),
  payouts AS (
    SELECT
      date(COALESCE(paid_at, approved_at, created_at)) as d,
      SUM(COALESCE(cash_amount, amount_usd, 0))    as paid
    FROM payout_requests
    WHERE user_id = auth.uid()
      AND status IN ('paid', 'approved')
    GROUP BY 1
  )
  SELECT
    days.d as day,
    COALESCE(gifts.coins, 0)    as coins,
    COALESCE(bonus.bonus, 0)    as bonus_coins,
    COALESCE(payouts.paid, 0)   as payouts_usd
  FROM days
  LEFT JOIN gifts   ON gifts.d = days.d
  LEFT JOIN bonus   ON bonus.d = days.d
  LEFT JOIN payouts ON payouts.d = days.d
  ORDER BY days.d;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_earnings_series(integer) TO authenticated;

-- 4. RPC: Hourly activity (average per hour of day, last 7 days)
CREATE OR REPLACE FUNCTION public.get_hourly_activity()
RETURNS TABLE (
  hour_of_day int,
  coins bigint,
  gifts_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    extract(hour from created_at)::int as hour_of_day,
    SUM(coins) as coins,
    COUNT(*)  as gifts_count
  FROM gift_ledger
  WHERE receiver_id = auth.uid()
    AND created_at >= now() - interval '7 days'
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_hourly_activity() TO authenticated;

-- 5. RPC: Top gifters (leaderboard)
CREATE OR REPLACE FUNCTION public.get_top_gifters(limit_count integer DEFAULT 10)
RETURNS TABLE (
  sender_id uuid,
  total_coins bigint,
  sender_username text,
  sender_avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    gl.sender_id,
    SUM(gl.coins) as total_coins,
    COALESCE(up.username, 'Unknown User') as sender_username,
    COALESCE(up.avatar_url, '') as sender_avatar_url
  FROM gift_ledger gl
  LEFT JOIN user_profiles up ON gl.sender_id = up.id
  WHERE gl.receiver_id = auth.uid()
  GROUP BY gl.sender_id, up.username, up.avatar_url
  ORDER BY SUM(gl.coins) DESC
  LIMIT limit_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_gifters(integer) TO authenticated;

-- 6. RPC: Battle & event earnings
CREATE OR REPLACE FUNCTION public.get_battle_and_event_earnings()
RETURNS TABLE (
  source text,
  coins bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    CASE 
      WHEN is_battle THEN 'battle'
      WHEN is_event  THEN 'event'
      ELSE 'other'
    END as source,
    SUM(coins) as coins
  FROM gift_ledger
  WHERE receiver_id = auth.uid()
  GROUP BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_battle_and_event_earnings() TO authenticated;

-- 7. RPC: TrollTract bonus summary (missing function)
CREATE OR REPLACE FUNCTION public.get_trolltract_bonus_summary()
RETURNS TABLE (
  total_bonus bigint,
  total_base bigint,
  total_gifts bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(SUM(bonus_amount), 0) as total_bonus,
    COALESCE(SUM(base_amount), 0) as total_base,
    COUNT(*) as total_gifts
  FROM trolltract_bonus_log
  WHERE user_id = auth.uid()
    AND bonus_amount > 0;
$$;

GRANT EXECUTE ON FUNCTION public.get_trolltract_bonus_summary() TO authenticated;

-- 8. RPC: Creator statistics summary
CREATE OR REPLACE FUNCTION public.get_creator_stats()
RETURNS TABLE (
  total_streams bigint,
  total_viewers bigint,
  avg_viewers_per_stream numeric,
  stream_duration_hours numeric,
  total_gifts bigint,
  unique_gifters bigint,
  avg_gift_per_viewer numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH stream_stats AS (
    SELECT
      COUNT(*) as total_streams,
      SUM(current_viewers) as total_viewers,
      AVG(current_viewers) as avg_viewers_per_stream,
      SUM(EXTRACT(EPOCH FROM (COALESCE(end_time, now()) - start_time))/3600) as stream_duration_hours
    FROM streams
    WHERE broadcaster_id = auth.uid()
  ),
  gift_stats AS (
    SELECT
      COUNT(*) as total_gifts,
      COUNT(DISTINCT sender_id) as unique_gifters,
      AVG(coins) as avg_gift_per_viewer
    FROM gift_ledger
    WHERE receiver_id = auth.uid()
  )
  SELECT
    ss.total_streams,
    ss.total_viewers,
    ss.avg_viewers_per_stream,
    ss.stream_duration_hours,
    gs.total_gifts,
    gs.unique_gifters,
    gs.avg_gift_per_viewer
  FROM stream_stats ss, gift_stats gs;
$$;

GRANT EXECUTE ON FUNCTION public.get_creator_stats() TO authenticated;

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gift_ledger_receiver_id ON gifts(receiver_id) WHERE receiver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gift_ledger_created_at ON gifts(created_at) WHERE receiver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gift_ledger_sender_id ON gifts(sender_id) WHERE receiver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trolltract_bonus_log_user_id ON trolltract_bonus_log(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id_status ON payout_requests(user_id, status);

-- 10. Add comments for documentation
COMMENT ON VIEW gift_ledger IS 'Analytics view that adapts the gifts table for creator dashboard RPCs';
COMMENT ON FUNCTION public.get_earnings_overview() IS 'Returns total coins earned, TrollTract bonuses, and payout information';
COMMENT ON FUNCTION public.get_daily_earnings_series(integer) IS 'Returns daily earnings data for the specified number of days';
COMMENT ON FUNCTION public.get_hourly_activity() IS 'Returns hourly activity patterns for the last 7 days';
COMMENT ON FUNCTION public.get_top_gifters(integer) IS 'Returns top gifters leaderboard with user information';
COMMENT ON FUNCTION public.get_battle_and_event_earnings() IS 'Returns earnings breakdown by source (battle, event, other)';
COMMENT ON FUNCTION public.get_trolltract_bonus_summary() IS 'Returns TrollTract bonus statistics';
COMMENT ON FUNCTION public.get_creator_stats() IS 'Returns comprehensive creator statistics including streams and viewer data';