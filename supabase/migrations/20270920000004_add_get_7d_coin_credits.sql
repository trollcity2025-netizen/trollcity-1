create or replace function public.get_7d_coin_credits(p_user_id uuid)
returns bigint
language plpgsql
as $$
declare
  has_delta boolean;
  has_coins boolean;
  has_amount_coins boolean;
  has_direction boolean;
  amount_expr text;
  sql_text text;
  result bigint;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'coin_ledger'
      and column_name = 'delta'
  ) into has_delta;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'coin_ledger'
      and column_name = 'coins'
  ) into has_coins;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'coin_ledger'
      and column_name = 'amount_coins'
  ) into has_amount_coins;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'coin_ledger'
      and column_name = 'direction'
  ) into has_direction;

  if has_delta then
    amount_expr := 'case when delta > 0 then delta else 0 end';
  elsif has_coins then
    amount_expr := 'coalesce(coins, 0)';
  elsif has_amount_coins then
    amount_expr := 'coalesce(amount_coins, 0)';
  else
    return 0;
  end if;

  sql_text := 'select coalesce(sum(' || amount_expr || '), 0) from public.coin_ledger ' ||
              'where user_id = $1 and created_at >= now() - interval ''7 days''';

  if has_direction then
    sql_text := sql_text || ' and direction = ''credit''';
  end if;

  execute sql_text into result using p_user_id;
  return coalesce(result, 0);
end;
$$;
