-- ============================
-- TROLLTRACT CORE SCHEMA
-- ============================

-- 1. Profiles: contract fields
alter table public.profiles
  add column if not exists is_contracted boolean default false,
  add column if not exists contract_signed_at timestamptz,
  add column if not exists contract_level integer default 1,
  add column if not exists contract_notes text;

-- 2. Contract log table
create table if not exists public.trolltract_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  coins_spent bigint not null,
  earnings_multiplier numeric(5,2) default 1.00,  -- 1.00 = 100% base
  goal_monthly_coins bigint default 50000,        -- example target
  signed_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_trolltract_contracts_user_id
  on public.trolltract_contracts(user_id);

create index if not exists idx_trolltract_contracts_signed_at
  on public.trolltract_contracts(signed_at desc);

-- 3. RLS setup
alter table public.trolltract_contracts enable row level security;

-- Users can view their own contracts
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'trolltract_contracts'
      and policyname = 'Users view their own contracts'
  ) then
    create policy "Users view their own contracts"
      on public.trolltract_contracts
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- Admin / officer view
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'trolltract_contracts'
      and policyname = 'Admins can view contracts'
  ) then
    create policy "Admins can view contracts"
      on public.trolltract_contracts
      for select
      using (
        coalesce(auth.jwt()->>'role', '') in ('admin', 'lead_troll_officer', 'troll_officer')
      );
  end if;
end $$;

-- Optional: prevent regular users from inserting directly (we use RPC)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'trolltract_contracts'
      and policyname = 'Only backend can insert contracts'
  ) then
    create policy "Only backend can insert contracts"
      on public.trolltract_contracts
      for insert
      with check (false);
  end if;
end $$;

-- ============================
-- TROLLTRACT STATUS VIEW
-- ============================
create or replace view public.trolltract_status as
select
  p.id as user_id,
  p.display_name,
  p.username,
  p.is_contracted,
  p.contract_signed_at,
  p.contract_level,
  t.coins_spent,
  t.earnings_multiplier,
  t.goal_monthly_coins,
  t.signed_at
from public.profiles p
left join lateral (
  select *
  from public.trolltract_contracts tc
  where tc.user_id = p.id
  order by tc.signed_at desc
  limit 1
) t on true;

-- ============================
-- RPC: GET CURRENT USER CONTRACT STATUS
-- ============================
create or replace function public.get_my_trolltract_status()
returns public.trolltract_status
language sql
security definer
set search_path = public
as $$
  select *
  from public.trolltract_status
  where user_id = auth.uid();
$$;

-- ============================
-- RPC: PURCHASE TROLLTRACT
--  - One-time purchase
--  - Cost: 20,000 paid coins
--  - Uses existing deduct_coins(user, amount, 'paid')
-- ============================
create or replace function public.purchase_trolltract()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_record public.wallets;
begin
  -- Already contracted?
  if exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_contracted = true
  ) then
    return 'already_contracted';
  end if;

  -- Lock wallet row & check balance
  select *
  into v_wallet_record
  from public.wallets
  where user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Wallet not found. Please contact support.';
  end if;

  if v_wallet_record.paid_coins < 20000 then
    return 'insufficient_funds';
  end if;

  -- Deduct 20,000 paid coins (assumes your deduct_coins throws on error)
  perform public.deduct_coins(auth.uid(), 20000, 'paid');

  -- Activate contract on profile
  update public.profiles
  set is_contracted = true,
      contract_signed_at = now(),
      contract_level = 1
  where id = auth.uid();

  -- Log contract
  insert into public.trolltract_contracts (
    user_id,
    coins_spent,
    earnings_multiplier,
    goal_monthly_coins
  ) values (
    auth.uid(),
    20000,
    1.10,      -- 10% earnings boost for contracted creators
    50000      -- example monthly goal (you can adjust in UI or admin)
  );

  return 'success';
end;
$$;