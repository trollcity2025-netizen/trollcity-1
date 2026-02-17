CREATE OR REPLACE FUNCTION public.approve_manual_order(
  p_order_id uuid,
  p_admin_id uuid,
  p_external_tx_id text
) returns table (success boolean, new_balance bigint, error_message text)
language plpgsql
security definer
SET search_path = public
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
    v_bank_result := public.troll_bank_credit_coins(v_order.user_id, v_order.coins, 'paid', 'manual_order', v_order.id, v_order.metadata);
    if not (v_bank_result->>'success')::boolean then
        return query select false, null::bigint, v_bank_result->>'error_message';
        return;
    end if;
    v_balance := (v_bank_result->>'new_balance')::bigint;
  end if;

  -- Mark as fulfilled
  update public.manual_coin_orders
    set status = 'fulfilled', fulfilled_at = now(), processed_by = p_admin_id
    where id = p_order_id;

  -- Final balance check
  if v_balance is null then
    select troll_coins into v_balance from public.user_profiles where id = v_order.user_id;
  end if;

  return query select true, v_balance, null::text;

exception
  when others then
    return query select false, null::bigint, SQLERRM;
end;
$$;