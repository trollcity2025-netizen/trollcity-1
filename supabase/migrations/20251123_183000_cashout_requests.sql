create extension if not exists "uuid-ossp";

create table if not exists user_payout_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  payout_method text check (payout_method in ('PayPal', 'CashApp', 'Venmo')),
  payout_details text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (user_id)
);

create table if not exists cashout_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  username text,
  full_name text,
  email text,
  payout_method text check (payout_method in ('PayPal', 'CashApp', 'Venmo')) not null,
  payout_details text not null,
  requested_coins integer not null,
  usd_value numeric(10,2) not null,
  status text not null default 'pending',
  admin_notes text,
  user_confirmation boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table cashout_requests enable row level security;
create policy "Users can view own cashout requests" on cashout_requests for select using (auth.uid() = user_id);
create policy "Users can create own cashout requests" on cashout_requests for insert with check (auth.uid() = user_id);
create policy "Admins can view all cashout requests" on cashout_requests for select using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));
create policy "Admins can update cashout requests" on cashout_requests for update using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

create or replace function set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_cashout_requests on cashout_requests;
create trigger set_timestamp_cashout_requests
before update on cashout_requests
for each row
execute procedure set_timestamp();

alter table user_payout_settings enable row level security;
create policy "Users can view own payout settings" on user_payout_settings for select using (auth.uid() = user_id);
create policy "Users can upsert own payout settings" on user_payout_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own payout settings" on user_payout_settings for update using (auth.uid() = user_id);
