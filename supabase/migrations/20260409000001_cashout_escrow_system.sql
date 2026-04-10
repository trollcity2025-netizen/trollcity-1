
-- Cashout Escrow System
-- Users can deposit gifted coins into non-reversible escrow for cashouts
-- Auto-reserves all escrowed coins every Thursday at 11:59pm MST

-- 1. Add cashout escrow columns
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS cashout_coins bigint NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cashout_reserved_coins bigint NOT NULL DEFAULT 0;

-- 2. Create deposit function - ONLY accepts gift_received coins
CREATE OR REPLACE FUNCTION public.deposit_to_cashout_escrow(p_amount bigint)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_total_gifted bigint;
  v_current_cashout bigint;
  v_available_gifted bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  -- Calculate total gifted coins ever received FROM PURCHASED COINS ONLY
  SELECT COALESCE(SUM(amount), 0) INTO v_total_gifted
  FROM public.coin_transactions
  WHERE user_id = v_user_id
    AND type = 'gift_received'
    AND amount > 0
    AND metadata->>'source' = 'purchased';

  -- Get current escrow balance
  SELECT COALESCE(cashout_coins, 0), COALESCE(cashout_reserved_coins, 0)
    INTO v_current_cashout, v_current_cashout
  FROM public.user_profiles
  WHERE id = v_user_id;

  -- Available = total gifted ever received minus already in escrow
  v_available_gifted := v_total_gifted - v_current_cashout - COALESCE(cashout_reserved_coins, 0);

  IF p_amount > v_available_gifted THEN
    RAISE EXCEPTION 'Insufficient eligible coins. You can only deposit coins that were gifted to you.';
  END IF;

  -- Deposit the coins (non-reversible)
  UPDATE public.user_profiles
  SET cashout_coins = cashout_coins + p_amount,
      updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'deposited', p_amount,
    'new_balance', v_current_cashout + p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.deposit_to_cashout_escrow(bigint) TO authenticated;

-- 3. Weekly cron: Run every Thursday at 11:59pm MST (America/Denver)
-- Reserves all coins in cashout escrow for Friday payouts
CREATE OR REPLACE FUNCTION public.reserve_all_cashout_coins()
RETURNS void AS $$
BEGIN
  -- Move all cashout_coins to cashout_reserved_coins
  UPDATE public.user_profiles
  SET cashout_reserved_coins = cashout_reserved_coins + cashout_coins,
      cashout_coins = 0,
      updated_at = now()
  WHERE cashout_coins > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update cashout request function to only use reserved escrow coins
CREATE OR REPLACE FUNCTION "public"."request_visa_redemption"("p_user_id" "uuid", "p_coins" bigint, "p_usd" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_available bigint;
  v_usd numeric(10,2);
  v_redemption_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NULL OR p_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  -- Validate tier
  v_usd := CASE p_coins
    WHEN 5000    THEN 25
    WHEN 15000   THEN 50
    WHEN 30000   THEN 150
    WHEN 60000   THEN 300
    WHEN 120000  THEN 600
    WHEN 200000  THEN 1000
    WHEN 400000  THEN 2000
    ELSE NULL
  END;

  IF v_usd IS NULL THEN
    RAISE EXCEPTION 'Invalid tier';
  END IF;

  IF p_usd IS NULL OR p_usd::numeric(10,2) <> v_usd THEN
    RAISE EXCEPTION 'USD does not match tier';
  END IF;

  -- ONLY use reserved escrow coins for cashouts
  SELECT COALESCE(cashout_reserved_coins, 0)
    INTO v_available
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF v_available < p_coins THEN
    RAISE EXCEPTION 'Insufficient reserved coins. Deposit coins into Cashout Escrow before Thursday 11:59pm.';
  END IF;

  -- Reserve the coins from escrow
  UPDATE public.user_profiles
  SET cashout_reserved_coins = cashout_reserved_coins - p_coins,
      reserved_troll_coins = COALESCE(reserved_troll_coins,0) + p_coins,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.visa_redemptions (
    user_id, coins_reserved, usd_amount, status, created_at
  ) VALUES (
    p_user_id, p_coins, v_usd, 'pending', now()
  )
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'redemption_id', v_redemption_id,
    'available_reserved', v_available,
    'RedemptionStatus', 'pending'
  );
END;
$$;
