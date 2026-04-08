-- Create request_paypal_payout function for PayPal payouts
CREATE OR REPLACE FUNCTION "public"."request_paypal_payout"("p_user_id" "uuid", "p_coins" bigint, "p_usd" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reserved bigint;
  v_available bigint;
  v_total bigint;
  v_usd numeric(10,2);
  v_payout_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NULL OR p_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  -- Validate tier and compute expected USD from payoutTiers.ts
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

  SELECT COALESCE(troll_coins,0), COALESCE(reserved_troll_coins,0)
    INTO v_total, v_reserved
  FROM public.user_profiles
  WHERE id = p_user_id;

  v_available := v_total - v_reserved;
  IF v_available < p_coins THEN
    RAISE EXCEPTION 'Insufficient available coins';
  END IF;

  -- Reserve the coins
  UPDATE public.user_profiles
  SET reserved_troll_coins = COALESCE(reserved_troll_coins,0) + p_coins,
      updated_at = now()
  WHERE id = p_user_id;

  -- Create payout request
  INSERT INTO public.payout_requests (
    user_id, coins_redeemed, cash_amount, status, created_at
  ) VALUES (
    p_user_id, p_coins, v_usd, 'pending', now()
  )
  RETURNING id INTO v_payout_id;

  RETURN jsonb_build_object(
    'payout_request_id', v_payout_id,
    'WalletBefore', jsonb_build_object(
      'available', v_available,
      'reserved', v_reserved
    ),
    'WalletAfter', jsonb_build_object(
      'available', v_available - p_coins,
      'reserved', v_reserved + p_coins
    ),
    'PayoutStatus', 'pending'
  );
END;
$$;

ALTER FUNCTION "public"."request_paypal_payout"("p_user_id" "uuid", "p_coins" bigint, "p_usd" numeric) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."request_paypal_payout"("p_user_id" "uuid", "p_coins" bigint, "p_usd" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."request_paypal_payout"("p_user_id" "uuid", "p_coins" bigint, "p_usd" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_paypal_payout"("p_user_id" "uuid", "p_coins" bigint, "p_usd" numeric) TO "service_role";