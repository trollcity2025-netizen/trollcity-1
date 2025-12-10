----------------------------------------------------
-- PROFILES ROLE COLUMN
----------------------------------------------------
alter table public.profiles
add column if not exists troll_role text default 'user'
check (troll_role in ('user','troll_officer','lead_troll_officer','admin'));

----------------------------------------------------
-- OFFICER APPLICATIONS
----------------------------------------------------
create table if not exists public.officer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending','approved','denied')),
  training_score int,
  experience text,
  social_links text,
  notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

----------------------------------------------------
-- OFFICER STRIKES / PENALTIES
----------------------------------------------------
create table if not exists public.officer_strikes (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid references public.profiles(id),
  issued_by uuid references public.profiles(id),
  reason text,
  points int default 1,
  created_at timestamptz default now()
);

----------------------------------------------------
-- OFFICER SHIFTS
----------------------------------------------------
create table if not exists public.officer_shifts (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid references public.profiles(id),
  started_at timestamptz default now(),
  ended_at timestamptz,
  auto_clockout boolean default false
);

----------------------------------------------------
-- INCIDENT REPORTS
----------------------------------------------------
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  reported_by uuid references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  stream_id text,
  category text,
  description text,
  evidence jsonb,
  status text default 'open'
    check (status in ('open','investigating','closed','escalated')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

----------------------------------------------------
-- TROLL COURT CASES
----------------------------------------------------
create table if not exists public.troll_court_cases (
  id uuid primary key default gen_random_uuid(),
  defendant_id uuid references public.profiles(id),
  prosecutor_id uuid references public.profiles(id),
  judge_id uuid references public.profiles(id),
  stream_id text,
  accusation text,
  status text default 'pending'
    check (status in ('pending','scheduled','complete')),
  fine_coins int default 0,
  scheduled_at timestamptz,
  created_at timestamptz default now()
);

----------------------------------------------------
-- PAYOUTS TABLE (IF YOU DON'T ALREADY HAVE A CLEAN ONE)
----------------------------------------------------
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  coin_amount bigint not null,
  usd_amount numeric(10,2) not null,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','failed')),
  payout_method text not null default 'paypal'
    check (payout_method in ('paypal','coins','manual')),
  processed_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

----------------------------------------------------
-- BASIC RLS
----------------------------------------------------
alter table public.officer_applications enable row level security;
alter table public.officer_strikes enable row level security;
alter table public.officer_shifts enable row level security;
alter table public.incidents enable row level security;
alter table public.troll_court_cases enable row level security;
alter table public.payouts enable row level security;

----------------------------------------------------
-- RLS FOR PAYOUTS
----------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payouts'
      and policyname = 'payouts_self_select'
  ) then
    create policy "payouts_self_select"
    on public.payouts
    for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payouts'
      and policyname = 'payouts_self_insert'
  ) then
    create policy "payouts_self_insert"
    on public.payouts
    for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payouts'
      and policyname = 'lead_can_view_payouts'
  ) then
    create policy "lead_can_view_payouts"
    on public.payouts
    for select
    using (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.troll_role in ('lead_troll_officer','admin')
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payouts'
      and policyname = 'lead_can_update_payouts'
  ) then
    create policy "lead_can_update_payouts"
    on public.payouts
    for update
    using (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.troll_role in ('lead_troll_officer','admin')
      )
    );
  end if;
end $$;