-- Ensure troll_coins is BIGINT and fix RPC variable types

-- 1. Drop view dependent on troll_coins
DROP VIEW IF EXISTS public.earnings_view;
DROP MATERIALIZED VIEW IF EXISTS public.user_earnings_summary;

-- 1.5 Drop legacy triggers blocking type change
DROP TRIGGER IF EXISTS trg_sync_trollstown_coins ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_set_trollstown_coins ON public.trollstown_properties;

-- 2. Ensure column is BIGINT
ALTER TABLE public.user_profiles 
ALTER COLUMN troll_coins TYPE BIGINT;

-- 3. Recreate earnings_view
CREATE OR REPLACE VIEW public.earnings_view AS
SELECT 
    p.id,
    p.username,
    COALESCE(p.total_earned_coins, 0)::bigint AS total_earned_coins,
    COALESCE(p.troll_coins, 0)::bigint AS troll_coins,
    0::numeric AS current_month_earnings,
    0::bigint AS current_month_transactions,
    0::numeric AS current_month_paid_out,
    0::numeric AS current_month_pending,
    0::numeric AS current_month_approved,
    0::bigint AS current_month_paid_count,
    0::bigint AS current_month_pending_count,
    0::numeric AS yearly_paid_usd,
    0::bigint AS yearly_payout_count,
    date_part('year'::text, now())::integer AS tax_year,
    'below_threshold'::text AS irs_threshold_status,
    NULL::timestamp AS last_payout_at,
    0::bigint AS pending_requests_count,
    0::numeric AS lifetime_paid_usd
FROM user_profiles p
WHERE p.is_broadcaster = true OR p.total_earned_coins > 0;

-- 4. Recreate user_earnings_summary
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_earnings_summary AS
WITH user_stats AS (
    SELECT 
        u.id as user_id,
        u.username,
        u.created_at as user_created_at,
        COALESCE(u.troll_coins, 0) as current_coin_balance,
        -- Eligible = Total - Bonus (Locked)
        GREATEST(COALESCE(u.troll_coins, 0) - COALESCE(u.bonus_coin_balance, 0), 0) as coins_eligible_for_cashout,
        COALESCE(u.bonus_coin_balance, 0) as coins_locked,
        u.is_banned,
        u.role
    FROM public.user_profiles u
),
ledger_stats AS (
    SELECT 
        user_id,
        COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) as total_coins_earned,
        COALESCE(SUM(CASE WHEN delta < 0 THEN ABS(delta) ELSE 0 END), 0) as total_coins_spent,
        COALESCE(MAX(CASE WHEN bucket = 'paid' AND source = 'cashout' THEN created_at END), NULL) as last_cashout_date
    FROM public.coin_ledger
    GROUP BY user_id
),
weekly_earnings AS (
    SELECT 
        user_id,
        COALESCE(SUM(delta), 0) as weekly_earned
    FROM public.coin_ledger
    WHERE delta > 0 
    AND created_at > (NOW() - INTERVAL '7 days')
    GROUP BY user_id
)
SELECT 
    us.user_id,
    us.username,
    COALESCE(ls.total_coins_earned, 0) as total_coins_earned,
    COALESCE(ls.total_coins_spent, 0) as total_coins_spent,
    us.current_coin_balance,
    us.coins_eligible_for_cashout,
    us.coins_locked,
    ls.last_cashout_date,
    COALESCE(we.weekly_earned, 0) as weekly_avg_earnings,
    CASE 
        WHEN us.coins_eligible_for_cashout >= 12000 -- Min threshold ($25)
             AND (NOW() - us.user_created_at) > INTERVAL '30 days'
             AND (us.is_banned IS FALSE OR us.is_banned IS NULL)
        THEN true 
        ELSE false 
    END as is_cashout_eligible,
    NOW() as last_refreshed_at
FROM user_stats us
LEFT JOIN ledger_stats ls ON us.user_id = ls.user_id
LEFT JOIN weekly_earnings we ON us.user_id = we.user_id;

-- Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_earnings_summary_user_id ON public.user_earnings_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_user_earnings_summary_eligible ON public.user_earnings_summary(is_cashout_eligible);


-- Grant permissions again just in case
GRANT SELECT ON public.earnings_view TO authenticated;
GRANT SELECT ON public.earnings_view TO service_role;

-- 4. Fix purchase_rgb_broadcast RPC to use BIGINT for balance check
-- (Adding dynamic drop to be safe)
DO $$ 
DECLARE r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature FROM pg_proc 
             WHERE proname = 'purchase_rgb_broadcast' AND pronamespace = 'public'::regnamespace 
    LOOP EXECUTE 'DROP FUNCTION ' || r.func_signature; END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION purchase_rgb_broadcast(p_stream_id UUID, p_enable BOOLEAN)
RETURNS TABLE (success BOOLEAN, message TEXT, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream record;
  v_user_id uuid;
  v_balance bigint; -- Explicitly BIGINT
  v_cost bigint := 10;
BEGIN
  -- Get stream info
  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
  
  IF v_stream IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Stream not found'::TEXT;
    RETURN;
  END IF;

  v_user_id := auth.uid();
  
  -- Check ownership (or admin)
  IF v_stream.user_id != v_user_id AND NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_user_id AND (role = 'admin' OR is_admin = true)) THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Not authorized'::TEXT;
    RETURN;
  END IF;

  -- If enabling
  IF p_enable THEN
    -- Check if already purchased
    IF v_stream.rgb_purchased THEN
      -- Just enable
      UPDATE public.streams SET has_rgb_effect = true WHERE id = p_stream_id;
      RETURN QUERY SELECT true, 'Enabled'::TEXT, NULL::TEXT;
    ELSE
      -- Need to purchase
      -- Check balance
      SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
      
      IF v_balance < v_cost THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Insufficient coins (Cost: 10)'::TEXT;
        RETURN;
      END IF;
      
      -- Deduct coins
      UPDATE public.user_profiles 
      SET troll_coins = troll_coins - v_cost 
      WHERE id = v_user_id;
      
      -- Update stream
      UPDATE public.streams 
      SET has_rgb_effect = true, rgb_purchased = true 
      WHERE id = p_stream_id;
      
      RETURN QUERY SELECT true, 'Purchased and Enabled'::TEXT, NULL::TEXT;
    END IF;
  ELSE
    -- Disabling
    UPDATE public.streams SET has_rgb_effect = false WHERE id = p_stream_id;
    RETURN QUERY SELECT true, 'Disabled'::TEXT, NULL::TEXT;
  END IF;
END;
$$;
