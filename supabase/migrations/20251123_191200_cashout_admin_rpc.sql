create or replace function admin_mark_cashout_paid(p_cashout_id uuid, p_payment_reference text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  flagged boolean := false;
  gross numeric := 0;
  base_perc numeric := 5;
  fee numeric := 0;
  extra_fee numeric := 0;
  net numeric := 0;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and role = 'admin') then
    raise exception 'not authorized';
  end if;

  select * into r from cashout_requests where id = p_cashout_id;
  if not found then
    raise exception 'cashout not found';
  end if;

  select exists(select 1 from user_bans where user_id = r.user_id and is_active = true)
    or exists(select 1 from admin_flags where user_id = r.user_id)
  into flagged;

  gross := coalesce(r.usd_value, 0);
  select coalesce(processing_fee_percentage, 5) into base_perc from cashout_tiers where coin_amount = r.requested_coins limit 1;
  fee := round(gross * base_perc / 100, 2);
  extra_fee := case when flagged then round(gross * 0.01, 2) else 0 end;
  net := round(gross - fee - extra_fee, 2);

  update cashout_requests
    set status = 'paid', admin_notes = concat('gross=', gross, ';fee=', fee, ';extra=', extra_fee, ';net=', net, ';ref=', coalesce(p_payment_reference,'')), updated_at = now()
    where id = p_cashout_id;

  insert into transactions(user_id, type, transaction_type, coins_used, amount, description, status, payment_method, metadata)
    values (r.user_id, 'cashout', 'cashout', r.requested_coins, net, 'Manual cashout', 'paid', r.payout_method,
            jsonb_build_object('gross', gross, 'fee', fee, 'extraFee', extra_fee, 'provider', r.payout_method, 'payout_details', r.payout_details, 'payment_reference', coalesce(p_payment_reference,'')));

  return jsonb_build_object('success', true, 'net', net, 'fee', fee, 'extraFee', extra_fee);
end;
$$;

create or replace function admin_mark_cashout_completed(p_cashout_id uuid, p_payment_reference text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and role = 'admin') then
    raise exception 'not authorized';
  end if;

  update cashout_requests
    set status = 'completed', admin_notes = case when p_payment_reference is null then admin_notes else coalesce(admin_notes,'') || ';ref=' || p_payment_reference end, updated_at = now()
    where id = p_cashout_id;

  return jsonb_build_object('success', true);
end;
$$;
