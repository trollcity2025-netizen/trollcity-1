-- Fix approve_manual_order to actually credit coins and mark orders fulfilled

DROP FUNCTION IF EXISTS public.approve_manual_order(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.approve_manual_order(
  p_order_id uuid,
  p_admin_id uuid,
  p_external_tx_id text
)
RETURNS TABLE(success boolean, new_balance bigint, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.manual_coin_orders%rowtype;
  v_balance bigint;
  v_purchase_type text;
  v_bank_result jsonb;
  v_credit_metadata jsonb;
BEGIN
  SELECT * INTO v_order
  FROM public.manual_coin_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::bigint, 'order not found'::text;
    RETURN;
  END IF;

  IF v_order.status <> 'pending' THEN
    IF v_order.status = 'fulfilled' THEN
      SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_order.user_id;
      RETURN QUERY SELECT true, v_balance, NULL::text;
      RETURN;
    END IF;
    RETURN QUERY SELECT false, NULL::bigint, 'invalid status'::text;
    RETURN;
  END IF;

  v_purchase_type := COALESCE(v_order.metadata->>'purchase_type', '');

  -- Mark paid immediately
  UPDATE public.manual_coin_orders
    SET status = 'paid',
        paid_at = now(),
        external_tx_id = COALESCE(p_external_tx_id, external_tx_id),
        processed_by = p_admin_id,
        updated_at = now()
  WHERE id = p_order_id;

  -- Troll Pass bundle path
  IF v_purchase_type = 'troll_pass_bundle' THEN
    PERFORM public.apply_troll_pass_bundle(v_order.user_id);
  ELSE
    v_credit_metadata := jsonb_build_object(
      'admin_id', p_admin_id,
      'manual_order_id', p_order_id,
      'external_tx_id', p_external_tx_id
    );

    -- Credit coins through Troll Bank (handle multiple possible function signatures)
    IF to_regprocedure('public.troll_bank_credit_coins(uuid,int,text,text,text,jsonb)') IS NOT NULL THEN
      SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins::int,
        'paid',
        'manual_purchase',
        p_order_id::text,
        v_credit_metadata
      )::jsonb INTO v_bank_result;
    ELSIF to_regprocedure('public.troll_bank_credit_coins(uuid,bigint,text,text,text,jsonb)') IS NOT NULL THEN
      SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins::bigint,
        'paid',
        'manual_purchase',
        p_order_id::text,
        v_credit_metadata
      )::jsonb INTO v_bank_result;
    ELSIF to_regprocedure('public.troll_bank_credit_coins(uuid,numeric,text,text,text,jsonb)') IS NOT NULL THEN
      SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins::numeric,
        'paid',
        'manual_purchase',
        p_order_id::text,
        v_credit_metadata
      )::jsonb INTO v_bank_result;
    ELSIF to_regprocedure('public.troll_bank_credit_coins(uuid,int,text,text,jsonb)') IS NOT NULL THEN
      -- Older signature: no ref_id param, metadata is 5th arg
      SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins::int,
        'paid',
        'manual_purchase',
        v_credit_metadata
      )::jsonb INTO v_bank_result;
    ELSIF to_regprocedure('public.troll_bank_credit_coins(uuid,bigint,text,text,jsonb)') IS NOT NULL THEN
      SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins::bigint,
        'paid',
        'manual_purchase',
        v_credit_metadata
      )::jsonb INTO v_bank_result;
    ELSIF to_regprocedure('public.troll_bank_credit_coins(uuid,int,text,text,json)') IS NOT NULL THEN
      -- Older signature: metadata is JSON (not JSONB)
      SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins::int,
        'paid',
        'manual_purchase',
        v_credit_metadata::json
      )::jsonb INTO v_bank_result;
    ELSIF to_regprocedure('public.troll_bank_credit_coins(uuid,bigint,text,text,json)') IS NOT NULL THEN
      SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins::bigint,
        'paid',
        'manual_purchase',
        v_credit_metadata::json
      )::jsonb INTO v_bank_result;
    ELSE
      RAISE EXCEPTION 'troll_bank_credit_coins signature not found';
    END IF;

    -- Update stats
    UPDATE public.user_profiles
    SET
      paid_coins = COALESCE(paid_coins, 0) + v_order.coins,
      total_earned_coins = COALESCE(total_earned_coins, 0) + v_order.coins
    WHERE id = v_order.user_id;
  END IF;

  -- Mark fulfilled
  UPDATE public.manual_coin_orders
    SET status = 'fulfilled',
        fulfilled_at = now(),
        updated_at = now()
  WHERE id = p_order_id;

  -- Send notification
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (v_order.user_id, 'coin_purchase', 'Coins Credited', 'Your manual coin purchase of ' || v_order.coins || ' coins has been approved and credited to your account.', jsonb_build_object('order_id', p_order_id));

  SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_order.user_id;
  RETURN QUERY SELECT true, v_balance, NULL::text;
END;
$$;
