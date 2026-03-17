-- Remove admin/CEO/staff exemptions from coin deduction
-- All users now pay full price for streaming, gas, etc.

-- 1. Update process_stream_billing to remove exempt roles
CREATE OR REPLACE FUNCTION public.process_stream_billing(
  p_stream_id UUID,
  p_user_id UUID,
  p_is_host BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream RECORD;
  v_user_profile RECORD;
  v_cost NUMERIC(20, 2);
  v_guest RECORD;
BEGIN
  -- Check if stream exists and is active
  SELECT * INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id;

  IF NOT FOUND OR v_stream.is_live = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stream not found or not active');
  END IF;

  -- Get user profile
  SELECT * INTO v_user_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- A. Broadcaster Billing (0.5 coins/min) - NO EXEMPTIONS
  IF p_is_host THEN
    v_cost := 0.5;

    IF v_cost > 0 THEN
        -- Check balance
        IF v_user_profile.troll_coins < v_cost THEN
           -- End stream if insufficient funds
           UPDATE public.streams
           SET is_live = false, ended_at = NOW()
           WHERE id = p_stream_id;
           
           RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds', 'action', 'end_stream');
        END IF;

        -- Deduct coins
        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_cost,
            total_spent_coins = total_spent_coins + v_cost
        WHERE id = p_user_id;

        -- Record transaction
        INSERT INTO public.coin_transactions (
          user_id,
          amount,
          type,
          description,
          stream_id
        ) VALUES (
          p_user_id,
          -v_cost,
          'stream_cost',
          'Broadcasting fee (1 min)',
          p_stream_id
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'cost', v_cost, 'remaining', v_user_profile.troll_coins - v_cost);
  END IF;

  -- B. Guest Billing (0.5 coins/min) - NO EXEMPTIONS
  SELECT * INTO v_guest
  FROM public.stream_guests
  WHERE stream_id = p_stream_id AND user_id = p_user_id AND status = 'active';

  IF FOUND THEN
      v_cost := 0.5;

      IF v_cost > 0 THEN
          IF v_user_profile.troll_coins < v_cost THEN
            -- Remove guest
            UPDATE public.stream_guests
            SET status = 'removed', left_at = NOW()
            WHERE stream_id = p_stream_id AND user_id = p_user_id;
            
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds', 'action', 'remove_guest');
          END IF;

          -- Deduct coins
          UPDATE public.user_profiles
          SET troll_coins = troll_coins - v_cost,
              total_spent_coins = total_spent_coins + v_cost
          WHERE id = p_user_id;

          -- Record transaction
          INSERT INTO public.coin_transactions (
            user_id,
            amount,
            type,
            description,
            stream_id
          ) VALUES (
            p_user_id,
            -v_cost,
            'stream_cost',
            'Guest participation fee (1 min)',
            p_stream_id
          );
      END IF;

      RETURN jsonb_build_object('success', true, 'cost', v_cost, 'remaining', v_user_profile.troll_coins - v_cost);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'User not associated with stream billing');
END;
$$;

-- 2. Update refill_gas to remove staff/level exemptions
CREATE OR REPLACE FUNCTION public.refill_gas(p_amount_percent NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_gas NUMERIC;
    v_cost BIGINT;
    v_new_gas NUMERIC;
    v_ledger_item_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Calculate Cost - NO EXEMPTIONS
    v_cost := CEIL((p_amount_percent / 5.0) * 300.0);

    -- Deduct Coins if cost > 0
    IF v_cost > 0 THEN
        PERFORM public.troll_bank_spend_coins(
            v_user_id,
            v_cost,
            'paid',
            'gas_refill',
            NULL,
            jsonb_build_object('amount', p_amount_percent)
        );

        -- Log to Purchase Ledger
        SELECT id INTO v_ledger_item_id FROM public.purchasable_items WHERE item_key = 'gas_refill' LIMIT 1;
        
        IF v_ledger_item_id IS NULL THEN
            INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_coin_pack, frontend_source)
            VALUES ('gas_refill', 'Gas Refill', 'consumable', 300, false, 'GasStation')
            RETURNING id INTO v_ledger_item_id;
        END IF;

        INSERT INTO public.purchase_ledger (
            user_id, item_id, coin_amount, payment_method, source_context, created_at
        ) VALUES (
            v_user_id, v_ledger_item_id, v_cost, 'coins', 'GasStation', now()
        );
    END IF;

    -- Update Gas
    UPDATE public.user_profiles
    SET gas_balance = LEAST(COALESCE(gas_balance, 0) + p_amount_percent, 100.0),
        last_gas_update = now()
    WHERE id = v_user_id
    RETURNING gas_balance INTO v_new_gas;

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_gas, 'cost', v_cost);
END;
$$;

-- 3. Update consume_gas to remove staff unlimited gas
CREATE OR REPLACE FUNCTION public.consume_gas(p_amount NUMERIC DEFAULT 5.0)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_gas NUMERIC;
BEGIN
    v_user_id := auth.uid();
    
    -- Normal consumption for ALL users - NO EXEMPTIONS
    UPDATE public.user_profiles
    SET gas_balance = GREATEST(COALESCE(gas_balance, 100) - p_amount, 0.0),
        last_gas_update = now()
    WHERE id = v_user_id
    RETURNING gas_balance INTO v_current_gas;
    
    RETURN jsonb_build_object('success', true, 'new_balance', v_current_gas);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.process_stream_billing(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_stream_billing(UUID, UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.refill_gas(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refill_gas(NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_gas(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_gas(NUMERIC) TO service_role;
