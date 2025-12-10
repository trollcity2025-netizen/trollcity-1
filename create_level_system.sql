-- USER LEVELS TABLE
create table if not exists public.user_levels (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  buyer_xp bigint not null default 0,
  buyer_level int not null default 1,
  stream_xp bigint not null default 0,
  stream_level int not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.user_levels enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_levels'
      and policyname = 'user_levels_self'
  ) then
    create policy "user_levels_self"
      on public.user_levels
      for select using (auth.uid() = user_id);
  end if;
end $$;

--------------------------------------------------
-- HELPER: ENSURE ROW
--------------------------------------------------
create or replace function ensure_user_levels(p_user uuid)
returns void
language plpgsql
as $$
begin
  insert into public.user_levels (user_id)
  values (p_user)
  on conflict (user_id) do nothing;
end;
$$;

--------------------------------------------------
-- BUYER LEVEL LOGIC (COIN BUYERS)
--------------------------------------------------
create or replace function update_buyer_level(p_user uuid)
returns void
language plpgsql
as $$
declare
  xp bigint;
  lvl int;
begin
  select buyer_xp into xp from public.user_levels where user_id = p_user;

  lvl := case
    when xp >= 3000000 then 10   -- IMMORTAL TROLL KING
    when xp >= 1500000 then 9    -- Ancient Elder Troll
    when xp >= 750000  then 8    -- Divine OverTroll
    when xp >= 300000  then 7    -- Mythic Benefactor
    when xp >= 150000  then 6    -- Titan of Troll City
    when xp >= 70000   then 5    -- Elite Troll Backer
    when xp >= 30000   then 4    -- Troll Champion
    when xp >= 10000   then 3    -- Chaos Supporter
    when xp >= 2000    then 2    -- Mischief Rookie
    else 1                       -- Goblin Sprout
  end;

  update public.user_levels
  set buyer_level = lvl,
      updated_at = now()
  where user_id = p_user;
end;
$$;

--------------------------------------------------
-- STREAM LEVEL LOGIC (BROADCASTERS)
--------------------------------------------------
create or replace function update_stream_level(p_user uuid)
returns void
language plpgsql
as $$
declare
  xp bigint;
  lvl int;
begin
  select stream_xp into xp from public.user_levels where user_id = p_user;

  lvl := case
    when xp >= 900000 then 10   -- Troll City MEGASTAR
    when xp >= 300000 then 9    -- Troll Star Icon
    when xp >= 120000 then 8    -- Mischief Legend
    when xp >= 60000  then 7    -- Troll Master Broadcaster
    when xp >= 30000  then 6    -- Elite Chaos Caster
    when xp >= 15000  then 5    -- Troll Arena Performer
    when xp >= 7500   then 4    -- Mayhem Broadcaster
    when xp >= 2000   then 3    -- Chaos Host
    when xp >= 500    then 2    -- Banter Beginner
    else 1                      -- Rookie Trollcaster
  end;

  update public.user_levels
  set stream_level = lvl,
      updated_at = now()
  where user_id = p_user;
end;
$$;

--------------------------------------------------
-- PUBLIC FUNCTIONS TO ADD XP
-- Call these from your PayPal / gifts backend
--------------------------------------------------

-- Every $1 spent on coins = 100 buyer XP (adjust if needed)
create or replace function add_buyer_xp(p_user uuid, p_usd numeric)
returns void
language plpgsql
as $$
declare
  add_xp bigint;
begin
  perform ensure_user_levels(p_user);

  add_xp := floor(p_usd * 100); -- 100 XP per $1

  update public.user_levels
  set buyer_xp = buyer_xp + add_xp,
      updated_at = now()
  where user_id = p_user;

  perform update_buyer_level(p_user);
end;
$$;

-- Every $1 in gifts received = 50 stream XP
create or replace function add_stream_xp(p_user uuid, p_usd numeric)
returns void
language plpgsql
as $$
declare
  add_xp bigint;
begin
  perform ensure_user_levels(p_user);

  add_xp := floor(p_usd * 50); -- 50 XP per $1

  update public.user_levels
  set stream_xp = stream_xp + add_xp,
      updated_at = now()
  where user_id = p_user;

  perform update_stream_level(p_user);
end;
$$;