create table if not exists officer_vote_cycles (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_officer_vote_cycles_active
  on officer_vote_cycles(status)
  where status = 'active';

create table if not exists officer_votes (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references officer_vote_cycles(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  broadcaster_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_officer_votes_unique
  on officer_votes(cycle_id, voter_id, broadcaster_id);

create index if not exists idx_officer_votes_cycle_broadcaster
  on officer_votes(cycle_id, broadcaster_id);

create table if not exists officer_assignments (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references officer_vote_cycles(id) on delete cascade,
  broadcaster_id uuid not null references public.user_profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_officer_assignments_broadcaster
  on officer_assignments(broadcaster_id, starts_at, ends_at);

create extension if not exists btree_gist;

alter table officer_assignments
  add constraint officer_assignments_no_overlap
  exclude using gist (
    broadcaster_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  );

alter table officer_vote_cycles enable row level security;
alter table officer_votes enable row level security;
alter table officer_assignments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'officer_vote_cycles'
      and policyname = 'Users can view officer vote cycles'
  ) then
    create policy "Users can view officer vote cycles" on officer_vote_cycles
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'officer_votes'
      and policyname = 'Users can view officer votes'
  ) then
    create policy "Users can view officer votes" on officer_votes
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'officer_votes'
      and policyname = 'Users can insert own officer vote'
  ) then
    create policy "Users can insert own officer vote" on officer_votes
      for insert
      with check (auth.uid() = voter_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'officer_assignments'
      and policyname = 'Users can view officer assignments'
  ) then
    create policy "Users can view officer assignments" on officer_assignments
      for select
      using (true);
  end if;
end
$$;

create or replace view active_troll_officers as
select
  oa.broadcaster_id as broadcaster_id,
  oa.starts_at,
  oa.ends_at,
  up.username,
  up.avatar_url
from officer_assignments oa
join public.user_profiles up on up.id = oa.broadcaster_id
where now() between oa.starts_at and oa.ends_at;

