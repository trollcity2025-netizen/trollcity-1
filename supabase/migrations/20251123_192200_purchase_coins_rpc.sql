create or replace function purchase_coins(p_user_id uuid, p_package_id text, p_coins bigint, p_amount numeric, p_square_tx_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  update user_profiles
    set paid_coin_balance = paid_coin_balance + p_coins,
        updated_at = now()
    where id = p_user_id;

  insert into coin_transactions(user_id, type, package_id, coins, amount_usd, payment_method, status, description, metadata)
    values (p_user_id, 'purchase', p_package_id, p_coins, p_amount, 'square', 'completed', 'Coin package purchase', jsonb_build_object('square_transaction_id', p_square_tx_id));

  insert into payment_transactions(user_id, coins_purchased, amount_paid, square_transaction_id)
    values (p_user_id, p_coins, p_amount, p_square_tx_id);

  return jsonb_build_object('success', true);
end;
$$;
