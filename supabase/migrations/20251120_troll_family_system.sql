create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  banner_url text,
  color_theme text,
  code text not null unique,
  xp integer not null default 0,
  royal_troll_member_id uuid,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role text not null default 'member',
  rank_name text not null default 'Troller Hatchling',
  level integer not null default 1,
  approved boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create unique index if not exists unique_royal_troll_per_family on public.family_members(family_id) where role = 'royal_troll';

create table if not exists public.family_tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  description text,
  category text not null check (category in ('display','influence','mischief','power')),
  deadline timestamptz,
  coin_reward integer not null default 0,
  xp_reward integer not null default 0,
  completion_type text not null check (completion_type in ('individual','group')),
  status text not null default 'active' check (status in ('active','completed','expired')),
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.family_tasks(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null check (status in ('completed','failed')),
  proof_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.family_lounge_messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('emoji_war_royale','gifty_clash_hour','troll_invasion_raid','troll_anthem_night')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  rules jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.war_results (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references public.wars(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  points integer not null default 0,
  rank integer,
  rewards jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.clan_rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  reward_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.clan_vault (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_tasks enable row level security;
alter table public.task_history enable row level security;
alter table public.family_lounge_messages enable row level security;
alter table public.wars enable row level security;
alter table public.war_results enable row level security;
alter table public.clan_rewards enable row level security;
alter table public.clan_vault enable row level security;

revoke all on all tables in schema public from anon;
grant select, insert, update on all tables in schema public to authenticated;

drop policy if exists "families readable by members" on public.families;
drop policy if exists "families admin access" on public.families;
drop policy if exists "members manage own family" on public.family_members;
drop policy if exists "members admin access" on public.family_members;
drop policy if exists "tasks by family members" on public.family_tasks;
drop policy if exists "tasks admin access" on public.family_tasks;
drop policy if exists "task history by members" on public.task_history;
drop policy if exists "task history admin access" on public.task_history;
drop policy if exists "lounge messages by members" on public.family_lounge_messages;
drop policy if exists "lounge messages admin access" on public.family_lounge_messages;
drop policy if exists "wars readable" on public.wars;
drop policy if exists "war results readable" on public.war_results;
drop policy if exists "clan rewards by members" on public.clan_rewards;
drop policy if exists "clan vault by members" on public.clan_vault;

create policy "families readable by members" on public.families for select to authenticated using (
  exists(select 1 from public.family_members m where m.family_id = families.id and m.user_id = auth.uid() and m.approved = true)
  or (auth.jwt() ->> 'email') = 'trollcity2025@gmail.com'
);

create policy "families insert" on public.families for insert to authenticated with check (created_by = auth.uid());

create policy "families update by royal or admin" on public.families for update to authenticated using (
  exists(select 1 from public.family_members m where m.family_id = families.id and m.user_id = auth.uid() and m.role = 'royal_troll' and m.approved = true)
  or (auth.jwt() ->> 'email') = 'trollcity2025@gmail.com'
);

create policy "members manage own family" on public.family_members for select using (
  exists(select 1 from public.family_members m where m.family_id = family_members.family_id and m.user_id = auth.uid() and m.approved = true)
  or (auth.jwt() ->> 'email') = 'trollcity2025@gmail.com'
);

create policy "members insert self" on public.family_members for insert to authenticated with check (user_id = auth.uid());

create policy "members approve by royal" on public.family_members for update to authenticated using (
  exists(select 1 from public.family_members m where m.family_id = family_members.family_id and m.user_id = auth.uid() and m.role = 'royal_troll' and m.approved = true)
  or (user_id = auth.uid())
  or (auth.jwt() ->> 'email') = 'trollcity2025@gmail.com'
);

create policy "tasks by family members" on public.family_tasks for all using (
  exists(select 1 from public.family_members m where m.family_id = family_tasks.family_id and m.user_id = auth.uid() and m.approved = true)
  or (auth.jwt() ->> 'email') = 'trollcity2025@gmail.com'
);

create policy "task history by members" on public.task_history for all using (
  exists(select 1 from public.family_members m join public.family_tasks t on t.id = task_history.task_id where m.family_id = t.family_id and m.user_id = auth.uid() and m.approved = true)
  or (auth.jwt() ->> 'email') = 'trollcity2025@gmail.com'
);

create policy "lounge messages by members" on public.family_lounge_messages for all using (
  exists(select 1 from public.family_members m where m.family_id = family_lounge_messages.family_id and m.user_id = auth.uid() and m.approved = true)
  or (auth.jwt() ->> 'email') = 'trollcity2025@gmail.com'
);

create policy "wars readable" on public.wars for select to authenticated using (true);

create policy "war results readable" on public.war_results for select to authenticated using (true);

create policy "clan rewards by members" on public.clan_rewards for all using (
  exists(select 1 from public.family_members m where m.family_id = clan_rewards.family_id and m.user_id = auth.uid() and m.approved = true)
  or (auth.jwt() ->> 'email') = 'trollcity2025@gmail.com'
);

create policy "clan vault by members" on public.clan_vault for all using (
  exists(select 1 from public.family_members m where m.family_id = clan_vault.family_id and m.user_id = auth.uid() and m.approved = true)
  or (auth.jwt() ->> 'email') = 'trollcity2025@gmail.com'
);
