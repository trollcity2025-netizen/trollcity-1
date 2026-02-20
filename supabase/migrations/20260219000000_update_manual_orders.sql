-- Update manual_coin_orders table for multiple providers
ALTER TABLE public.manual_coin_orders
ADD COLUMN payer_id text;
ALTER TABLE public.manual_coin_orders
RENAME COLUMN cashapp_cashtag TO provider_id;

-- Update the approve_manual_order function
DROP FUNCTION IF EXISTS public.approve_manual_order(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.approve_manual_order(
  p_order_id uuid,
  p_admin_id uuid,
  p_external_tx_id text
) RETURNS TABLE (success boolean, new_balance integer, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order public.manual_coin_orders%rowtype;
  v_balance integer;
BEGIN
  SELECT * INTO v_order FROM public.manual_coin_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::integer, 'order not found';
    RETURN;
  END IF;
  IF v_order.status <> 'pending' THEN
    IF v_order.status = 'fulfilled' THEN
      SELECT coin_balance INTO v_balance FROM public.wallets WHERE user_id = v_order.user_id;
      RETURN QUERY SELECT TRUE, v_balance, NULL::text;
      RETURN;
    END IF;
    RETURN QUERY SELECT FALSE, NULL::integer, 'invalid status';
    RETURN;
  END IF;

  -- mark paid
  UPDATE public.manual_coin_orders SET status = 'paid', paid_at = now(), external_tx_id = coalesce(p_external_tx_id, external_tx_id)
  WHERE id = p_order_id;

  -- credit coins
  UPDATE public.wallets SET coin_balance = coin_balance + v_order.coins WHERE user_id = v_order.user_id RETURNING coin_balance INTO v_balance;
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, coin_balance) VALUES (v_order.user_id, v_order.coins) RETURNING coin_balance INTO v_balance;
  END IF;

  -- ledger row
  INSERT INTO public.wallet_transactions (user_id, type, currency, amount, reason, source, reference_id, metadata)
  VALUES (v_order.user_id, 'manual_purchase', 'troll_coins', v_order.coins, v_order.provider || ' purchase', v_order.provider, v_order.id,
          jsonb_build_object('admin_id', p_admin_id, 'amount_cents', v_order.amount_cents));

  -- finalize
  UPDATE public.manual_coin_orders SET status = 'fulfilled', fulfilled_at = now() WHERE id = p_order_id;

  RETURN QUERY SELECT TRUE, v_balance, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_manual_order(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_manual_order(uuid, uuid, text) TO service_role;
