-- 20270308000001_dashboard_rpcs.sql

-- 1. Update constraint to allow payouts
ALTER TABLE public.officer_pay_ledger DROP CONSTRAINT IF EXISTS officer_pay_ledger_source_type_check;
ALTER TABLE public.officer_pay_ledger ADD CONSTRAINT officer_pay_ledger_source_type_check 
  CHECK (source_type IN ('property_rent', 'house_upgrade', 'vehicle_purchase', 'vehicle_registration', 'vehicle_insurance', 'vehicle_tax', 'officer_tax', 'fine', 'officer_payout'));

-- 2. RPC to get cashout forecast
CREATE OR REPLACE FUNCTION get_cashout_forecast(
  projection_percent integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  eligible_users_count bigint;
  total_eligible_coins numeric;
  total_exposure_usd numeric;
  median_payout numeric;
  top_earners jsonb;
BEGIN
  -- Check permissions
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND (role IN ('admin', 'secretary', 'president') OR is_admin = true)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 1. Base Stats (Count & Total Coins)
  SELECT
    COUNT(*),
    COALESCE(SUM(coins_eligible_for_cashout), 0)
  INTO eligible_users_count, total_eligible_coins
  FROM public.user_earnings_summary
  WHERE is_cashout_eligible = true;

  -- 2. USD Exposure (Tiered Calculation)
  SELECT COALESCE(SUM(
    CASE
      WHEN coins_eligible_for_cashout >= 120000 THEN coins_eligible_for_cashout * (355.0 / 120000.0)
      WHEN coins_eligible_for_cashout >= 60000 THEN coins_eligible_for_cashout * (150.0 / 60000.0)
      WHEN coins_eligible_for_cashout >= 26375 THEN coins_eligible_for_cashout * (70.0 / 26375.0)
      WHEN coins_eligible_for_cashout >= 12000 THEN coins_eligible_for_cashout * (25.0 / 12000.0)
      ELSE 0
    END
  ), 0)
  INTO total_exposure_usd
  FROM public.user_earnings_summary
  WHERE is_cashout_eligible = true;

  -- 3. Apply Projection
  -- If projection is < 100, we assume a linear reduction for simple forecasting
  IF projection_percent < 100 THEN
    total_eligible_coins := total_eligible_coins * (projection_percent::numeric / 100.0);
    total_exposure_usd := total_exposure_usd * (projection_percent::numeric / 100.0);
    eligible_users_count := (eligible_users_count * (projection_percent::numeric / 100.0))::bigint;
  END IF;

  -- 4. Top 10 Earners (Always show actual top earners)
  SELECT jsonb_agg(t) INTO top_earners
  FROM (
    SELECT user_id, username, coins_eligible_for_cashout
    FROM public.user_earnings_summary
    WHERE is_cashout_eligible = true
    ORDER BY coins_eligible_for_cashout DESC
    LIMIT 10
  ) t;

  -- 5. Median Payout
  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY coins_eligible_for_cashout)
  INTO median_payout
  FROM public.user_earnings_summary
  WHERE is_cashout_eligible = true;

  result := jsonb_build_object(
    'eligible_users_count', eligible_users_count,
    'total_eligible_coins', total_eligible_coins,
    'total_exposure_usd', total_exposure_usd,
    'top_earners', COALESCE(top_earners, '[]'::jsonb),
    'median_payout', COALESCE(median_payout, 0)
  );

  RETURN result;
END;
$$;

-- 3. RPC for Officer Payroll Stats
CREATE OR REPLACE FUNCTION get_officer_payroll_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pool_balance bigint;
  weekly_earnings bigint;
  weekly_payouts bigint;
  distributions jsonb;
BEGIN
  -- Check permissions
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND (role IN ('admin', 'secretary', 'president', 'troll_officer', 'lead_officer', 'chief_officer') OR is_admin = true)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Pool Balance (Sum of all transactions)
  SELECT COALESCE(SUM(coin_amount), 0) INTO pool_balance
  FROM public.officer_pay_ledger;
  
  -- Weekly Earnings (Inflows > 0 this week)
  SELECT COALESCE(SUM(coin_amount), 0) INTO weekly_earnings
  FROM public.officer_pay_ledger
  WHERE created_at >= date_trunc('week', now())
  AND coin_amount > 0;

  -- Weekly Payouts (Outflows < 0 this week, e.g. payouts)
  SELECT COALESCE(ABS(SUM(coin_amount)), 0) INTO weekly_payouts
  FROM public.officer_pay_ledger
  WHERE created_at >= date_trunc('week', now())
  AND coin_amount < 0;

  -- Get Active Distributions
  SELECT jsonb_agg(d) INTO distributions
  FROM (
    SELECT 
      od.officer_user_id,
      up.username,
      od.percentage_share,
      od.role
    FROM public.officer_distribution od
    JOIN public.user_profiles up ON up.id = od.officer_user_id
    WHERE od.is_active = true
    ORDER BY od.percentage_share DESC
  ) d;

  RETURN jsonb_build_object(
    'pool_balance', pool_balance,
    'weekly_earnings', weekly_earnings,
    'weekly_payouts', weekly_payouts,
    'distributions', COALESCE(distributions, '[]'::jsonb)
  );
END;
$$;
