-- Migration: Fix Payout Tiers to match Frontend Theme
-- 1. Update Tiers
DELETE FROM payout_tiers;
INSERT INTO payout_tiers (id, coins_required, usd_amount) VALUES
('tier_starter', 7000, 21.00),
('tier_bronze', 14000, 49.50),
('tier_silver', 27000, 90.00),
('tier_gold', 47000, 150.00)
ON CONFLICT (id) DO UPDATE SET
coins_required = EXCLUDED.coins_required,
usd_amount = EXCLUDED.usd_amount;

-- 2. Update prepare_payout_run to use 7000 threshold
CREATE OR REPLACE FUNCTION prepare_payout_run()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run_id UUID;
  v_user RECORD;
  v_tier RECORD;
  v_count INTEGER := 0;
  v_total_coins BIGINT := 0;
  v_total_usd NUMERIC := 0;
  v_logs JSONB := '[]'::jsonb;
BEGIN
  -- Create Run
  INSERT INTO payout_runs (status) VALUES ('processing') RETURNING id INTO v_run_id;

  -- Iterate eligible users (Threshold 7000)
  FOR v_user IN 
    SELECT id, troll_coins, payout_paypal_email
    FROM user_profiles
    WHERE payout_paypal_email IS NOT NULL
      AND length(payout_paypal_email) > 5
      AND (is_banned IS FALSE OR is_banned IS NULL)
      AND troll_coins >= 7000 -- UPDATED THRESHOLD
  LOOP
    -- Find highest eligible tier
    SELECT * INTO v_tier
    FROM payout_tiers
    WHERE coins_required <= v_user.troll_coins
    ORDER BY coins_required DESC
    LIMIT 1;

    IF v_tier IS NOT NULL THEN
      -- Create Payout Record
      INSERT INTO payouts (run_id, user_id, tier_id, amount_coins, amount_usd, paypal_email, status)
      VALUES (v_run_id, v_user.id, v_tier.id, v_tier.coins_required, v_tier.usd_amount, v_user.payout_paypal_email, 'queued');
      
      -- Deduct Coins (Atomic)
      UPDATE user_profiles
      SET troll_coins = troll_coins - v_tier.coins_required
      WHERE id = v_user.id;
      
      -- Ledger Entry
      INSERT INTO coin_ledger (user_id, delta, bucket, source, ref_id, reason)
      VALUES (v_user.id, -v_tier.coins_required, 'payout', 'automatic_payout', v_run_id::text, 'Automatic Payout: ' || v_tier.id);
      
      v_count := v_count + 1;
      v_total_coins := v_total_coins + v_tier.coins_required;
      v_total_usd := v_total_usd + v_tier.usd_amount;
    END IF;
  END LOOP;

  -- Update Run Stats
  UPDATE payout_runs
  SET total_payouts = v_count,
      total_coins = v_total_coins,
      total_usd = v_total_usd,
      logs = v_logs
  WHERE id = v_run_id;

  RETURN v_run_id;
END;
$$;

-- 3. Grant permissions on View (if not already done)
GRANT SELECT ON public.payout_history_view TO authenticated;
