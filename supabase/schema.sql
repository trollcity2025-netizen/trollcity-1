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
add column if not exists ended_by uuid references public.user_profiles(id),
add column if not exists is_live boolean default true;

alter table public.streams
add column if not exists is_trolls_night boolean default false,
add column if not exists trolls_night_category text;


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

-- Trolls Night profile flags
alter table if exists public.user_profiles
add column if not exists is_trolls_night_approved boolean default false,
add column if not exists trolls_night_rejection_count integer default 0;

create or replace function public.is_trolls_night_staff(p_user_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from public.user_profiles up
    where up.id = p_user_id
      and (
        up.is_admin = true
        or up.role = 'admin'
        or up.is_troll_officer = true
        or up.role = 'troll_officer'
        or up.is_lead_officer = true
        or up.role = 'lead_troll_officer'
      )
  );
$$;

create table if not exists public.trolls_night_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  id_type text,
  id_number text,
  id_document_url text,
  category_preference text,
  additional_notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'disqualified')),
  rejection_reason text,
  rejection_count integer default 0,
  last_reviewed_by uuid references public.user_profiles(id),
  last_reviewed_at timestamptz,
  disqualified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tna_user on public.trolls_night_applications(user_id);
create index if not exists idx_tna_status on public.trolls_night_applications(status);

alter table public.trolls_night_applications enable row level security;

create or replace function public.trolls_night_application_status_trigger()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.rejection_count := coalesce(new.rejection_count, 0);

  if tg_op = 'insert' then
    new.created_at := coalesce(new.created_at, now());
  end if;

  if new.status = 'approved' then
    new.rejection_count := 0;
    new.disqualified_at := null;
    update public.user_profiles
    set is_trolls_night_approved = true,
        trolls_night_rejection_count = 0
    where id = new.user_id;
  elsif new.status = 'rejected' then
    if coalesce(old.status, '') <> 'rejected' then
      new.rejection_count := coalesce(old.rejection_count, 0) + 1;
    else
      new.rejection_count := coalesce(old.rejection_count, 0);
    end if;
    if new.rejection_count >= 3 then
      new.status := 'disqualified';
      new.disqualified_at := now();
    else
      new.disqualified_at := null;
    end if;
    update public.user_profiles
    set is_trolls_night_approved = false,
        trolls_night_rejection_count = new.rejection_count
    where id = new.user_id;
  elsif new.status = 'disqualified' then
    new.disqualified_at := coalesce(new.disqualified_at, now());
    new.rejection_count := greatest(new.rejection_count, coalesce(old.rejection_count, 0));
    update public.user_profiles
    set is_trolls_night_approved = false,
        trolls_night_rejection_count = new.rejection_count
    where id = new.user_id;
  else
    update public.user_profiles
    set is_trolls_night_approved = false,
        trolls_night_rejection_count = new.rejection_count
    where id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_trolls_night_application_status on public.trolls_night_applications;
create trigger trg_trolls_night_application_status
before insert or update on public.trolls_night_applications
for each row
execute function public.trolls_night_application_status_trigger();

create policy "Users can submit their own Trolls Night application"
on public.trolls_night_applications for insert
with check (
  auth.uid() = user_id
  and not exists (
    select 1 from public.trolls_night_applications tna
    where tna.user_id = auth.uid()
      and tna.status in ('pending', 'approved')
  )
);

create policy "Users can view their Trolls Night application"
on public.trolls_night_applications for select
using (auth.uid() = user_id);

create policy "Users can update their pending Trolls Night application"
on public.trolls_night_applications for update
using (auth.uid() = user_id and status = 'pending')
with check (auth.uid() = user_id and status = 'pending');

create policy "Trolls Night staff can manage applications"
on public.trolls_night_applications for select, update, delete
using (public.is_trolls_night_staff(auth.uid()))
with check (public.is_trolls_night_staff(auth.uid()));

create table if not exists public.trolls_night_guest_agreements (
  id uuid primary key default gen_random_uuid(),
  broadcaster_id uuid not null references public.user_profiles(id) on delete cascade,
  guest_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'approved' check (status in ('approved', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trolls_night_guest_agreements_unique_pair unique (broadcaster_id, guest_id),
  constraint trolls_night_guest_not_self check (broadcaster_id <> guest_id)
);

create index if not exists idx_tnga_broadcaster on public.trolls_night_guest_agreements(broadcaster_id);
create index if not exists idx_tnga_guest on public.trolls_night_guest_agreements(guest_id);

alter table public.trolls_night_guest_agreements enable row level security;

create or replace function public.trolls_night_guest_limit_guard()
returns trigger
language plpgsql
as $$
declare
  verified boolean;
  active_count integer;
begin
  if new.guest_id is null then
    raise exception 'Guest identifier required';
  end if;

  select exists (
    select 1 from public.user_profiles
    where id = new.guest_id
      and is_verified = true
  ) into verified;

  if not verified then
    raise exception 'Guest must be a verified user';
  end if;

  if new.status = 'approved' then
    select count(*) from public.trolls_night_guest_agreements
    where broadcaster_id = new.broadcaster_id
      and status = 'approved'
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000')
    into active_count;

    if active_count >= 3 then
      raise exception 'Maximum of 3 verified guests per broadcaster';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_trolls_night_guest_limits on public.trolls_night_guest_agreements;
create trigger trg_trolls_night_guest_limits
before insert or update on public.trolls_night_guest_agreements
for each row
execute function public.trolls_night_guest_limit_guard();

create policy "Broadcasters can manage their guest agreements"
on public.trolls_night_guest_agreements for select, insert, update, delete
using (auth.uid() = broadcaster_id)
with check (auth.uid() = broadcaster_id);

create policy "Staff can manage guest agreements"
on public.trolls_night_guest_agreements for select, insert, update, delete
using (public.is_trolls_night_staff(auth.uid()))
with check (public.is_trolls_night_staff(auth.uid()));

create policy "Guests can view their guest agreements"
on public.trolls_night_guest_agreements for select
using (auth.uid() = guest_id);
