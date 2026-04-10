
-- Fix cashout system to only allow actually purchased coins for redemption
-- Users can only cashout coins that were purchased directly, NOT gifted, generated, or free coins

-- 1. Add purchased_coins tracking column to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS purchased_coins bigint NOT NULL DEFAULT 0;

-- 2. Backfill purchased_coins for existing users from coin_transactions
UPDATE public.user_profiles up
SET purchased_coins = (
  SELECT COALESCE(SUM(amount), 0)
  FROM public.coin_transactions ct
  WHERE ct.user_id = up.id
    AND ct.type = 'gift_received'
    AND ct.amount > 0
);

-- 3. Create trigger to automatically update purchased_coins when transactions are added
CREATE OR REPLACE FUNCTION public.update_purchased_coins()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'gift_received' AND NEW.amount > 0 THEN
    UPDATE public.user_profiles
    SET purchased_coins = purchased_coins + NEW.amount
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_purchased_coins ON public.coin_transactions;
CREATE TRIGGER trigger_update_purchased_coins
AFTER INSERT ON public.coin_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_purchased_coins();

-- 4. Fix request_visa_redemption to only allow purchased coins for cashout
CREATE OR REPLACE FUNCTION "public"."request_visa_redemption"("p_user_id" "uuid", "p_coins" bigint, "p_usd" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reserved bigint;
  v_purchased_total bigint;
  v_purchased_available bigint;
  v_usd numeric(10,2);
  v_redemption_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NULL OR p_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  -- Validate tier and compute expected USD
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

  -- ONLY USE PURCHASED COINS FOR CASHOUT ELIGIBILITY
  SELECT COALESCE(purchased_coins,0), COALESCE(reserved_troll_coins,0)
    INTO v_purchased_total, v_reserved
  FROM public.user_profiles
  WHERE id = p_user_id;

  v_purchased_available := v_purchased_total - v_reserved;
  IF v_purchased_available < p_coins THEN
    RAISE EXCEPTION 'Insufficient purchased coins. Only coins bought directly from the store are eligible for cashout.';
  END IF;

  -- Reserve the coins
  UPDATE public.user_profiles
  SET reserved_troll_coins = COALESCE(reserved_troll_coins,0) + p_coins,
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
    'WalletBefore', jsonb_build_object(
      'available_purchased', v_purchased_available,
      'reserved', v_reserved
    ),
    'WalletAfter', jsonb_build_object(
      'available_purchased', v_purchased_available - p_coins,
      'reserved', v_reserved + p_coins
    ),
    'RedemptionStatus', 'pending'
  );
END;
$$;
