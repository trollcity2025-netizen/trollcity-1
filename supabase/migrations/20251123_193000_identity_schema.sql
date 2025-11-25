create table if not exists user_levels (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  level integer not null default 1,
  xp bigint not null default 0,
  total_xp bigint not null default 0,
  next_level_xp bigint not null default 100,
  updated_at timestamptz default now()
);

create table if not exists troll_dna_profiles (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  primary_dna text,
  traits jsonb default '[]',
  aura_style text,
  personality_scores jsonb default '{}',
  evolution_score numeric(12,2) default 0,
  updated_at timestamptz default now()
);

create table if not exists troll_dna_traits (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  rarity text not null,
  icon text,
  effect_class text,
  config jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists troll_dna_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  event_type text not null,
  data jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists identity_reward_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  type text not null,
  amount numeric(12,2),
  data jsonb default '{}',
  created_at timestamptz default now()
);

alter table user_levels enable row level security;
alter table troll_dna_profiles enable row level security;
alter table troll_dna_traits enable row level security;
alter table troll_dna_events enable row level security;
alter table identity_reward_logs enable row level security;

create policy ul_select_self on user_levels for select to authenticated using (user_id = auth.uid());
create policy ul_upsert_self on user_levels for insert to authenticated with check (user_id = auth.uid());
create policy ul_update_self on user_levels for update to authenticated using (user_id = auth.uid());

create policy dna_select_self on troll_dna_profiles for select to authenticated using (user_id = auth.uid());
create policy dna_upsert_self on troll_dna_profiles for insert to authenticated with check (user_id = auth.uid());
create policy dna_update_self on troll_dna_profiles for update to authenticated using (user_id = auth.uid());

create policy dna_traits_select_all on troll_dna_traits for select to authenticated using (true);

create policy dna_events_select_self on troll_dna_events for select to authenticated using (user_id = auth.uid());
create policy dna_events_insert_self on troll_dna_events for insert to authenticated with check (user_id = auth.uid());

create policy rewards_select_self on identity_reward_logs for select to authenticated using (user_id = auth.uid());
create policy rewards_insert_self on identity_reward_logs for insert to authenticated with check (user_id = auth.uid());
