-- user_payment_methods
create table if not exists public.user_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  provider text not null,                            -- 'card', 'cashapp', etc.
  token_id text not null,                            -- vault token from processor
  display_name text,                                 -- e.g. "Visa ••••1234"
  brand text,                                        -- Visa, Mastercard
  last4 text,                                        -- Last 4 digits
  exp_month int,
  exp_year int,
  square_customer_id text,
  square_card_id text,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.user_payment_methods enable row level security;

-- Allow users to view ONLY their own methods
create policy "Allow user to view own methods"
on public.user_payment_methods
for select
using (auth.uid() = user_id);

-- Allow users to insert their own methods
create policy "Allow user to insert own methods"
on public.user_payment_methods
for insert
with check (auth.uid() = user_id);

-- Allow users to delete their own methods
create policy "Allow user to delete own methods"
on public.user_payment_methods
for delete
using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_upm_user on public.user_payment_methods(user_id);
create unique index if not exists idx_upm_unique on public.user_payment_methods(user_id, provider, token_id);


-- Update transactions table
alter table public.transactions
add column if not exists gift_beneficiary uuid references public.user_profiles(id),
add column if not exists is_app_sponsored boolean default false;

-- Update streams table
alter table public.streams
add column if not exists is_force_ended boolean default false,
add column if not exists ended_by uuid references public.user_profiles(id);


-- coin_transactions table
create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  amount integer not null,
  type text not null,                                -- purchase, gift, spin, etc
  description text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Indexes & RLS
create index if not exists idx_tx_user on public.coin_transactions(user_id);
create index if not exists idx_tx_type on public.coin_transactions(type);
alter table public.coin_transactions enable row level security;

create policy "Allow user to view own transactions"
on public.coin_transactions
for select
using (auth.uid() = user_id);

create policy "Allow user to insert own transactions"
on public.coin_transactions
for insert
with check (auth.uid() = user_id);


-- payouts table
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  payout_amount numeric not null,
  provider text not null default 'square',
  status text not null default 'pending',           -- pending, processing, paid
  square_payout_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_payouts_user on public.payouts(user_id);
create index if not exists idx_payouts_status on public.payouts(status);

alter table public.payouts enable row level security;

create policy "Allow user to view own payouts"
on public.payouts
for select
using (auth.uid() = user_id);

create policy "Allow user to insert own payouts"
on public.payouts
for insert
with check (auth.uid() = user_id);


-- Troll Family Crown badges
alter table public.troll_family_members
add column if not exists has_crown_badge boolean default false,
add column if not exists crown_expiry timestamptz null;

create or replace function public.grant_family_crown(p_family_id uuid)
returns void
language plpgsql
as $$
begin
  update public.troll_family_members
  set has_crown_badge = true,
      crown_expiry = now() + interval '7 days'
  where family_id = p_family_id;
end;
$$;

-- Cleanup expired crowns
update public.troll_family_members
set has_crown_badge = false,
    crown_expiry = null
where crown_expiry is not null
  and crown_expiry < now();
