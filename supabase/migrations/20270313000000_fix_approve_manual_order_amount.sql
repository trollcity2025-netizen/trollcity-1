CREATE OR REPLACE FUNCTION public.approve_manual_order(
  p_order_id uuid,
  p_admin_id uuid,
  p_external_tx_id text
) returns table (success boolean, new_balance bigint, error_message text)
language plpgsql
security definer
SET search_path = ''
as $$
declare
  v_order public.manual_coin_orders%rowtype;
  v_balance bigint;
  v_purchase_type text;
  v_troll_pass_expires_at timestamptz;
  v_bank_result jsonb;
begin
  select * into v_order from public.manual_coin_orders where id = p_order_id for update;
  if not found then
    return query select false, null::bigint, 'order not found';
    return;
  end if;
  if v_order.status <> 'pending' then
    if v_order.status = 'fulfilled' then
      -- Just return current balance
      select troll_coins into v_balance from public.user_profiles where id = v_order.user_id;
      return query select true, v_balance, null::text;
      return;
    end if;
    return query select false, null::bigint, 'invalid status';
    return;
  end if;

  v_purchase_type := coalesce(v_order.metadata->>'purchase_type', '');

  update public.manual_coin_orders
    set status = 'paid', paid_at = now(), external_tx_id = coalesce(p_external_tx_id, external_tx_id)
    where id = p_order_id;

  -- Handle Troll Pass vs Regular Coins
  if v_purchase_type = 'troll_pass_bundle' then
    v_troll_pass_expires_at := public.apply_troll_pass_bundle(v_order.user_id);
  else
    -- Regular coin purchase
    -- Use Troll Bank
    SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins,
        'paid',
        'manual_purchase',
        p_order_id::text
    ) INTO v_bank_result;
    
    -- Update stats (total_earned_coins, etc) - Troll Bank only updates troll_coins and ledger.
    -- We might need to update total_earned_coins separately if it's tracked separately from balance.
    UPDATE public.user_profiles
    SET 
        paid_coins = coalesce(paid_coins, 0) + v_order.coins,
        total_earned_coins = coalesce(total_earned_coins, 0) + v_order.coins
    WHERE id = v_order.user_id;
  end if;

  -- Insert wallet transaction (legacy/audit?)
  -- Fixed: v_order.amount_usd does not exist, using v_order.amount_cents
  insert into public.wallet_transactions (user_id, type, currency, amount, reason, source, reference_id, metadata)
  values (
    v_order.user_id,
    'credit',
    'USD', 
    v_order.amount_cents,
    'Coin Purchase',
    'manual_order',
    p_order_id, 
    v_order.metadata
  );

  -- Get final balance
  select troll_coins into v_balance from public.user_profiles where id = v_order.user_id;
  return query select true, v_balance, null::text;
end;
$$;
