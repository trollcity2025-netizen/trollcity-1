
-- President System Migration

-- 1. Add username_style to profiles
alter table user_profiles add column if not exists username_style text default 'default';

-- 1.5 RBAC Infrastructure
create table if not exists system_roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  hierarchy_rank int not null default 0,
  is_staff boolean default false,
  is_admin boolean default false,
  description text,
  created_at timestamptz default now()
);

create table if not exists user_role_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id) on delete cascade,
  role_id uuid references system_roles(id) on delete cascade,
  granted_by uuid references user_profiles(id),
  created_at timestamptz default now(),
  expires_at timestamptz,
  unique(user_id, role_id)
);

-- RLS for Roles
alter table system_roles enable row level security;
alter table user_role_grants enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'system_roles' and policyname = 'Public read system roles') then
    create policy "Public read system roles" on system_roles for select using (true);
  end if;
  
  if not exists (select 1 from pg_policies where tablename = 'user_role_grants' and policyname = 'Public read role grants') then
    create policy "Public read role grants" on user_role_grants for select using (true);
  end if;
end $$;

-- 2. Roles
insert into system_roles (name, hierarchy_rank, is_staff, is_admin, description)
values
  ('president', 200, true, false, 'Elected President of Troll City'),
  ('vice_president', 180, true, false, 'Appointed Vice President'),
  ('secretary', 150, true, false, 'Election Administrator')
on conflict (name) do nothing;

-- 3. Badges
insert into badge_catalog (slug, name, description, category, rarity, sort_order)
values
  ('president', 'Mr. President', 'Elected President of Troll City', 'community', 'mythic', 100)
on conflict (slug) do nothing;

-- 4. Tables

-- Elections
create table if not exists president_elections (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('draft', 'open', 'closed', 'finalized', 'void')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  winner_candidate_id uuid,
  metadata jsonb default '{}'::jsonb
);

-- Candidates
create table if not exists president_candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references president_elections(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  banner_path text not null,
  display_name text,
  slogan text,
  statement text,
  created_at timestamptz not null default now(),
  approved_by uuid references user_profiles(id),
  approved_at timestamptz,
  unique(election_id, user_id)
);

-- Add circular FK
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'fk_president_elections_winner'
  ) then
    alter table president_elections 
      add constraint fk_president_elections_winner 
      foreign key (winner_candidate_id) 
      references president_candidates(id);
  end if;
end $$;

-- Votes
create table if not exists president_votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references president_elections(id) on delete cascade,
  candidate_id uuid not null references president_candidates(id) on delete cascade,
  voter_id uuid not null references user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  week_key text not null,
  unique(election_id, voter_id, week_key)
);

-- Trigger for week_key
create or replace function set_president_vote_week_key()
returns trigger as $$
begin
  -- ISO week format: YYYY-Www e.g. 2026-W05
  new.week_key := to_char(new.created_at, 'IYYY-"W"IW');
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_set_president_vote_week_key on president_votes;
create trigger tr_set_president_vote_week_key
before insert on president_votes
for each row execute function set_president_vote_week_key();

-- Treasury Ledger
create table if not exists president_treasury_ledger (
  id uuid primary key default gen_random_uuid(),
  amount_cents bigint not null,
  kind text not null check (kind in ('deposit', 'reserve', 'release', 'spend', 'refund')),
  currency text not null default 'USD',
  external_ref text,
  actor_id uuid references user_profiles(id),
  funded_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb
);

-- Treasury View
create or replace view president_treasury_balance as
select
  currency,
  coalesce(sum(amount_cents), 0) as balance_cents
from president_treasury_ledger
group by currency;

-- Payout Policy
create table if not exists payout_policy (
  id uuid primary key default gen_random_uuid(),
  rate_per_coin_cents numeric not null default 0.0,
  max_payout_cents bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references user_profiles(id)
);

-- Initialize default policy if empty
insert into payout_policy (rate_per_coin_cents, max_payout_cents)
select 0.0, 0
where not exists (select 1 from payout_policy);

-- Appointments
create table if not exists president_appointments (
  id uuid primary key default gen_random_uuid(),
  president_user_id uuid not null references user_profiles(id),
  vice_president_user_id uuid not null references user_profiles(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'removed', 'expired')),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references user_profiles(id),
  metadata jsonb default '{}'::jsonb
);

-- RLS
alter table president_elections enable row level security;
alter table president_candidates enable row level security;
alter table president_votes enable row level security;
alter table president_treasury_ledger enable row level security;
alter table payout_policy enable row level security;
alter table president_appointments enable row level security;

-- Policies
-- Public read
drop policy if exists "Public read elections" on president_elections;
create policy "Public read elections" on president_elections for select using (true);

drop policy if exists "Public read candidates" on president_candidates;
create policy "Public read candidates" on president_candidates for select using (status = 'approved' or auth.uid() = user_id or exists (select 1 from user_profiles where id = auth.uid() and (is_admin = true or role = 'secretary')));

drop policy if exists "Public read votes" on president_votes;
create policy "Public read votes" on president_votes for select using (false); -- No direct read of votes

-- Ledger Policy
drop policy if exists "Staff read ledger" on president_treasury_ledger;
create policy "Staff read ledger" on president_treasury_ledger for select using (
  exists (
    select 1 from user_role_grants urg
    join system_roles sr on urg.role_id = sr.id
    where urg.user_id = auth.uid()
    and (urg.expires_at is null or urg.expires_at > now())
    and sr.name in ('president', 'vice_president', 'secretary')
  )
  or
  exists (select 1 from user_profiles where id = auth.uid() and is_admin = true)
);

drop policy if exists "Staff read appointments" on president_appointments;
create policy "Staff read appointments" on president_appointments for select using (true);

-- Functions

-- Helper: Award Badge
create or replace function award_badge_db(p_user_id uuid, p_slug text)
returns void
language plpgsql
as $$
declare
  v_badge_id uuid;
begin
  select id into v_badge_id from badge_catalog where slug = p_slug;
  if v_badge_id is not null then
    insert into user_badges (user_id, badge_id)
    values (p_user_id, v_badge_id)
    on conflict do nothing;
  end if;
end;
$$;

-- 1. Create Election
create or replace function create_president_election()
returns uuid
security definer
language plpgsql
as $$
declare
  new_id uuid;
begin
  -- Check permission (Admin/Secretary)
  if not exists (select 1 from user_profiles where id = auth.uid() and (is_admin = true or role = 'secretary')) then
     raise exception 'Not authorized';
  end if;

  -- Check existing open election
  if exists (select 1 from president_elections where status in ('open', 'draft') and ends_at > now()) then
     raise exception 'Election already in progress';
  end if;

  insert into president_elections (status, starts_at, ends_at, created_by)
  values ('open', now(), now() + interval '3 weeks', auth.uid())
  returning id into new_id;

  return new_id;
end;
$$;

-- 2. Eligible Candidate Check
create or replace function is_eligible_president_candidate(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_banned boolean;
  v_created_at timestamptz;
begin
  -- Basic checks on user_profiles
  select 
    coalesce(is_banned, false), 
    created_at
  into v_banned, v_created_at
  from user_profiles where id = p_user_id;
  
  if v_banned then return false; end if;
  if v_created_at > now() - interval '14 days' then return false; end if;
  
  -- Placeholder for credit score check if table/column exists
  -- For now, return true
  return true;
end;
$$;

-- 3. Signup Candidate
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature 
             FROM pg_proc 
             WHERE proname = 'signup_president_candidate' 
             AND pronamespace = 'public'::regnamespace 
    LOOP 
        EXECUTE 'DROP FUNCTION ' || r.func_signature; 
    END LOOP; 
END $$;

create or replace function signup_president_candidate(
  p_election_id uuid,
  p_banner_path text,
  p_display_name text,
  p_slogan text,
  p_statement text
)
returns uuid
security definer
language plpgsql
as $$
declare
  v_id uuid;
  v_status text;
begin
  -- Check eligibility
  if not is_eligible_president_candidate(auth.uid()) then
    raise exception 'Not eligible';
  end if;

  -- Check election open
  if not exists (select 1 from president_elections where id = p_election_id and status = 'open') then
    raise exception 'Election not open';
  end if;

  -- Default status: pending
  v_status := 'pending';

  insert into president_candidates (election_id, user_id, status, banner_path, display_name, slogan, statement)
  values (p_election_id, auth.uid(), v_status, p_banner_path, p_display_name, p_slogan, p_statement)
  returning id into v_id;

  return v_id;
end;
$$;

-- 4. Vote
create or replace function vote_for_president_candidate(
  p_election_id uuid,
  p_candidate_id uuid
)
returns void
security definer
language plpgsql
as $$
begin
  -- Check election open
  if not exists (select 1 from president_elections where id = p_election_id and status = 'open') then
    raise exception 'Election not open';
  end if;
  
  -- Check candidate approved
  if not exists (select 1 from president_candidates where id = p_candidate_id and status = 'approved') then
    raise exception 'Candidate not approved';
  end if;

  -- Insert vote (trigger sets week_key, unique constraint handles dupes)
  insert into president_votes (election_id, candidate_id, voter_id)
  values (p_election_id, p_candidate_id, auth.uid());
end;
$$;

-- 5. Finalize Election
create or replace function finalize_president_election(p_election_id uuid)
returns void
security definer
language plpgsql
as $$
declare
  v_winner_id uuid;
  v_candidate_id uuid;
  v_ends_at timestamptz;
  v_role_id uuid;
begin
  select ends_at into v_ends_at from president_elections where id = p_election_id;
  
  if now() < v_ends_at then
    -- raise exception 'Election not ended yet'; 
    -- Allow manual finalization if admin? Or just enforce time?
    -- Req says "only if now() >= ends_at".
    raise exception 'Election not ended yet';
  end if;

  -- Pick winner
  select c.user_id, c.id into v_winner_id, v_candidate_id
  from president_candidates c
  join president_votes v on c.id = v.candidate_id
  where c.election_id = p_election_id and c.status = 'approved'
  group by c.user_id, c.id
  order by count(*) desc
  limit 1;
  
  if v_winner_id is null then
     update president_elections set status = 'void' where id = p_election_id;
     return;
  end if;

  -- Get President Role ID
  select id into v_role_id from system_roles where name = 'president';

  -- Expire old president(s)
  update user_role_grants
  set expires_at = now()
  where role_id = v_role_id and (expires_at is null or expires_at > now());

  -- Grant new president
  insert into user_role_grants (user_id, role_id, expires_at)
  values (v_winner_id, v_role_id, now() + interval '2 months');
  
  -- Grant Badge (idempotent)
  perform award_badge_db(v_winner_id, 'president'); 
  
  update user_profiles
  set username_style = 'gold'
  where id = v_winner_id;

  -- Close election
  update president_elections set status = 'finalized', winner_candidate_id = v_candidate_id where id = p_election_id;
end;
$$;

-- 6. Raise Payouts
create or replace function president_raise_payouts(p_amount_cents bigint)
returns void
security definer
language plpgsql
as $$
declare
  v_balance bigint;
begin
  -- Check President
  if not exists (
    select 1 from user_role_grants urg
    join system_roles sr on urg.role_id = sr.id
    where urg.user_id = auth.uid() 
    and sr.name = 'president'
    and (urg.expires_at is null or urg.expires_at > now())
  ) then
    raise exception 'Not President';
  end if;

  -- Check Treasury
  select coalesce(sum(amount_cents), 0) into v_balance from president_treasury_ledger where currency = 'USD';
  
  if v_balance < p_amount_cents then
    raise exception 'Insufficient funds';
  end if;

  -- Deduct/Reserve
  insert into president_treasury_ledger (amount_cents, kind, currency, actor_id)
  values (-p_amount_cents, 'reserve', 'USD', auth.uid());
  
  -- Update Policy
  update payout_policy
  set max_payout_cents = max_payout_cents + p_amount_cents; 
  
end;
$$;

-- 7. Appoint VP
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN SELECT oid::regprocedure AS func_signature 
             FROM pg_proc 
             WHERE proname = 'appoint_vice_president' 
             AND pronamespace = 'public'::regnamespace 
    LOOP 
        EXECUTE 'DROP FUNCTION ' || r.func_signature; 
    END LOOP; 
END $$;

create or replace function appoint_vice_president(p_user_id uuid)
returns void
security definer
language plpgsql
as $$
declare
  v_pres_expires timestamptz;
  v_vp_role_id uuid;
begin
  -- Check President & Get Expiry
  select urg.expires_at into v_pres_expires
  from user_role_grants urg
  join system_roles sr on urg.role_id = sr.id
  where urg.user_id = auth.uid() 
  and sr.name = 'president'
  and (urg.expires_at is null or urg.expires_at > now());
  
  if v_pres_expires is null then
    raise exception 'Not President';
  end if;
  
  -- Remove existing VP
  update president_appointments
  set status = 'removed', removed_at = now(), removed_by = auth.uid()
  where status = 'active';
  
  select id into v_vp_role_id from system_roles where name = 'vice_president';
  
  -- Expire existing VP role grants
  update user_role_grants
  set expires_at = now()
  where role_id = v_vp_role_id and (expires_at is null or expires_at > now());
  
  -- Create Appointment
  insert into president_appointments (president_user_id, vice_president_user_id, ends_at)
  values (auth.uid(), p_user_id, v_pres_expires);
  
  -- Grant Role
  insert into user_role_grants (user_id, role_id, expires_at)
  values (p_user_id, v_vp_role_id, v_pres_expires);
end;
$$;

-- 8. Remove VP
create or replace function remove_vice_president()
returns void
security definer
language plpgsql
as $$
declare
  v_vp_role_id uuid;
begin
   -- Check President
  if not exists (
    select 1 from user_role_grants urg
    join system_roles sr on urg.role_id = sr.id
    where urg.user_id = auth.uid() 
    and sr.name = 'president'
    and (urg.expires_at is null or urg.expires_at > now())
  ) then
    raise exception 'Not President';
  end if;

  update president_appointments
  set status = 'removed', removed_at = now(), removed_by = auth.uid()
  where status = 'active';

  select id into v_vp_role_id from system_roles where name = 'vice_president';

  update user_role_grants
  set expires_at = now()
  where role_id = v_vp_role_id and (expires_at is null or expires_at > now());
end;
$$;

-- 9. Revert Styles
create or replace function revert_expired_president_styles()
returns void
security definer
language plpgsql
as $$
begin
  update user_profiles
  set username_style = 'default'
  where username_style = 'gold'
  and not exists (
    select 1 from user_role_grants urg
    join system_roles sr on urg.role_id = sr.id
    where urg.user_id = user_profiles.id
    and sr.name = 'president'
    and (urg.expires_at is null or urg.expires_at > now())
  );
end;
$$;

-- Leaderboard Views
drop view if exists president_weekly_leaderboard;
create or replace view president_weekly_leaderboard as
select
  pc.election_id,
  pc.user_id,
  pc.display_name,
  pc.banner_path,
  pc.slogan,
  pv.week_key,
  count(pv.id) as vote_count
from president_candidates pc
join president_votes pv on pc.id = pv.candidate_id
where pc.status = 'approved'
group by pc.election_id, pc.user_id, pc.display_name, pc.banner_path, pc.slogan, pv.week_key;

drop view if exists president_total_leaderboard;
create or replace view president_total_leaderboard as
select
  pc.election_id,
  pc.user_id,
  pc.display_name,
  pc.banner_path,
  pc.slogan,
  count(pv.id) as vote_count
from president_candidates pc
join president_votes pv on pc.id = pv.candidate_id
where pc.status = 'approved'
group by pc.election_id, pc.user_id, pc.display_name, pc.banner_path, pc.slogan;

-- Candidate Approval (Secretary)
create or replace function approve_president_candidate(p_candidate_id uuid)
returns void
security definer
language plpgsql
as $$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and (role = 'secretary' or is_admin = true)) then
    raise exception 'Not authorized';
  end if;

  update president_candidates
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = p_candidate_id;
end;
$$;

create or replace function reject_president_candidate(p_candidate_id uuid)
returns void
security definer
language plpgsql
as $$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and (role = 'secretary' or is_admin = true)) then
    raise exception 'Not authorized';
  end if;

  update president_candidates
  set status = 'rejected'
  where id = p_candidate_id;
end;
$$;

-- Grant permissions on functions
grant execute on function create_president_election to authenticated;
grant execute on function signup_president_candidate to authenticated;
grant execute on function vote_for_president_candidate to authenticated;
grant execute on function president_raise_payouts to authenticated;
grant execute on function appoint_vice_president to authenticated;
grant execute on function remove_vice_president to authenticated;
grant execute on function approve_president_candidate to authenticated;
grant execute on function reject_president_candidate to authenticated;
