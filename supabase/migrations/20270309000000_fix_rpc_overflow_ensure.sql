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
 WITH gift_earnings AS (
         SELECT gifts.receiver_id AS user_id,
            sum(gifts.cost) AS total_coins_earned,
            count(*) AS gift_count,
            date_trunc('month'::text, gifts.created_at) AS month
           FROM gifts
          WHERE gifts.receiver_id IS NOT NULL
          GROUP BY gifts.receiver_id, (date_trunc('month'::text, gifts.created_at))
        ), transaction_earnings AS (
         SELECT coin_transactions.user_id,
            sum(coin_transactions.amount) AS total_coins_earned,
            count(*) AS transaction_count,
            date_trunc('month'::text, coin_transactions.created_at) AS month
           FROM coin_transactions
          WHERE (coin_transactions.type = ANY (ARRAY['gift_receive'::text, 'gift'::text])) AND coin_transactions.amount > 0
          GROUP BY coin_transactions.user_id, (date_trunc('month'::text, coin_transactions.created_at))
        ), combined_earnings AS (
         SELECT COALESCE(g.user_id, t.user_id) AS user_id,
            COALESCE(g.month, t.month) AS month,
            COALESCE(g.total_coins_earned, 0::numeric) + COALESCE(t.total_coins_earned, 0::bigint)::numeric AS total_coins,
            COALESCE(g.gift_count, 0::bigint) + COALESCE(t.transaction_count, 0::bigint) AS transaction_count
           FROM gift_earnings g
             FULL JOIN transaction_earnings t ON g.user_id = t.user_id AND g.month = t.month
        ), payout_summary AS (
         SELECT payout_requests.user_id,
            date_trunc('month'::text, payout_requests.created_at) AS month,
            sum(
                CASE
                    WHEN payout_requests.status = 'paid'::text THEN COALESCE(payout_requests.cash_amount, 0::numeric)
                    ELSE 0::numeric
                END) AS paid_out_usd,
            sum(
                CASE
                    WHEN payout_requests.status = 'pending'::text THEN COALESCE(payout_requests.cash_amount, 0::numeric)
                    ELSE 0::numeric
                END) AS pending_usd,
            sum(
                CASE
                    WHEN payout_requests.status = 'approved'::text THEN COALESCE(payout_requests.cash_amount, 0::numeric)
                    ELSE 0::numeric
                END) AS approved_usd,
            count(*) FILTER (WHERE payout_requests.status = 'paid'::text) AS paid_count,
            count(*) FILTER (WHERE payout_requests.status = 'pending'::text) AS pending_count
           FROM payout_requests
          GROUP BY payout_requests.user_id, (date_trunc('month'::text, payout_requests.created_at))
        ), yearly_payouts AS (
         SELECT payout_requests.user_id,
            date_part('year'::text, payout_requests.created_at)::integer AS year,
            sum(COALESCE(payout_requests.cash_amount, 0::numeric)) AS total_paid_usd,
            count(*) AS payout_count
           FROM payout_requests
          WHERE payout_requests.status = 'paid'::text
          GROUP BY payout_requests.user_id, (date_part('year'::text, payout_requests.created_at))
        )
 SELECT p.id,
    p.username,
    p.total_earned_coins,
    p.troll_coins,
    COALESCE(ce.total_coins, 0::numeric) AS current_month_earnings,
    COALESCE(ce.transaction_count, 0::bigint) AS current_month_transactions,
    COALESCE(ps.paid_out_usd, 0::numeric) AS current_month_paid_out,
    COALESCE(ps.pending_usd, 0::numeric) AS current_month_pending,
    COALESCE(ps.approved_usd, 0::numeric) AS current_month_approved,
    COALESCE(ps.paid_count, 0::bigint) AS current_month_paid_count,
    COALESCE(ps.pending_count, 0::bigint) AS current_month_pending_count,
    COALESCE(yp.total_paid_usd, 0::numeric) AS yearly_paid_usd,
    COALESCE(yp.payout_count, 0::bigint) AS yearly_payout_count,
    COALESCE(yp.year, date_part('year'::text, now())::integer) AS tax_year,
        CASE
            WHEN COALESCE(yp.total_paid_usd, 0::numeric) >= 600::numeric THEN 'over_threshold'::text
            WHEN COALESCE(yp.total_paid_usd, 0::numeric) >= 500::numeric THEN 'nearing_threshold'::text
            ELSE 'below_threshold'::text
        END AS irs_threshold_status,
    ( SELECT max(pr.created_at) AS max
           FROM payout_requests pr
          WHERE pr.user_id = p.id AND pr.status = 'paid'::text) AS last_payout_at,
    ( SELECT count(*) AS count
           FROM payout_requests pr
          WHERE pr.user_id = p.id AND pr.status = 'pending'::text) AS pending_requests_count,
    ( SELECT sum(COALESCE(pr.cash_amount, 0::numeric)) AS sum
           FROM payout_requests pr
          WHERE pr.user_id = p.id AND pr.status = 'paid'::text) AS lifetime_paid_usd
   FROM user_profiles p
     LEFT JOIN combined_earnings ce ON ce.user_id = p.id AND ce.month = date_trunc('month'::text, now())
     LEFT JOIN payout_summary ps ON ps.user_id = p.id AND ps.month = date_trunc('month'::text, now())
     LEFT JOIN yearly_payouts yp ON yp.user_id = p.id AND yp.year = date_part('year'::text, now())::integer
  WHERE p.is_broadcaster = true OR p.total_earned_coins > 0::numeric;

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
