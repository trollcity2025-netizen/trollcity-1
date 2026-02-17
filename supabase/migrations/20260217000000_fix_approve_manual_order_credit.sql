-- Fix approve_manual_order function to properly credit coins
-- The function was checking for wrong JSON keys from troll_bank_credit_coins

DROP FUNCTION IF EXISTS public.approve_manual_order(uuid, uuid, text);

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
  v_credit_result jsonb;
  v_coins_to_credit bigint;
begin
  -- Get the order
  select * into v_order from public.manual_coin_orders where id = p_order_id for update;
  
  if not found then
    return query select false, null::bigint, 'Order not found';
    return;
  end if;
  
  -- Check status
  if v_order.status <> 'pending' then
    if v_order.status = 'fulfilled' then
      select troll_coins into v_balance from public.user_profiles where id = v_order.user_id;
      return query select true, v_balance, null::text;
      return;
    end if;
    return query select false, null::bigint, 'Invalid order status: ' || v_order.status;
    return;
  end if;

  v_purchase_type := coalesce(v_order.metadata->>'purchase_type', '');

  -- Determine coins to credit - handle both new (coins) and legacy (amount) columns
  -- The coins column might have the value, or amount column for legacy orders
  v_coins_to_credit := coalesce(v_order.coins, v_order.amount, 0)::bigint;
  
  -- If still 0, try to get from metadata
  if v_coins_to_credit = 0 then
    v_coins_to_credit := coalesce((v_order.metadata->>'coins')::bigint, 0);
  end if;
  
  if v_coins_to_credit <= 0 then
    return query select false, null::bigint, 'No coins to credit - order may have invalid amount';
    return;
  end if;

  -- Update status to 'paid'
  update public.manual_coin_orders
    set status = 'paid', paid_at = now(), external_tx_id = coalesce(p_external_tx_id, external_tx_id)
    where id = p_order_id;

  -- Handle Troll Pass vs Regular Coins
  if v_purchase_type = 'troll_pass_bundle' then
    v_troll_pass_expires_at := public.apply_troll_pass_bundle(v_order.user_id);
  else
    -- Regular coin purchase - credit via troll_bank_credit_coins
    -- The function returns {repay, user_gets, new_loan_balance, loan_status}
    v_credit_result := public.troll_bank_credit_coins(
      v_order.user_id,
      v_coins_to_credit::int,
      'paid',
      'manual_order',
      p_order_id::text,
      v_order.metadata
    );
    
    -- Check if credit was successful by verifying user got coins
    -- If user_gets is null or 0, something went wrong
    if v_credit_result is null then
      -- Rollback the status update
      update public.manual_coin_orders set status = 'pending' where id = p_order_id;
      return query select false, null::bigint, 'Failed to credit coins - no response from bank';
      return;
    end if;
    
    -- Get the actual coins credited to user (may be less due to loan repayment)
    v_coins_to_credit := coalesce((v_credit_result->>'user_gets')::bigint, 0);
    
    if v_coins_to_credit <= 0 then
      -- Rollback the status update
      update public.manual_coin_orders set status = 'pending' where id = p_order_id;
      return query select false, null::bigint, 'No coins credited after loan repayment';
      return;
    end if;
  end if;

  -- Mark as fulfilled
  update public.manual_coin_orders
    set status = 'fulfilled', fulfilled_at = now(), processed_by = p_admin_id
    where id = p_order_id;

  -- Get final balance
  select troll_coins into v_balance from public.user_profiles where id = v_order.user_id;

  return query select true, v_balance, null::text;

exception
  when others then
    -- Make sure to rollback status on error
    update public.manual_coin_orders set status = 'pending' where id = p_order_id;
    return query select false, null::bigint, SQLERRM;
end;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.approve_manual_order(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_manual_order(uuid, uuid, text) TO authenticated;
