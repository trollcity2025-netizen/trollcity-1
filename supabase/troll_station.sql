-- Troll Station - Community Radio System with LiveKit
-- Run this file to set up the Troll Station feature

-- Station Settings
create table if not exists public.troll_station (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Troll Station',
  description text,
  is_online boolean default false,
  current_mode text default 'auto',
  current_dj_id uuid references public.user_profiles(id),
  current_song_id uuid,
  current_track_start timestamptz,
  volume real default 0.8,
  voice_enabled boolean default true,
  music_volume real default 0.7,
  livekit_room_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Song Submissions
create table if not exists public.troll_station_songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  audio_url text not null,
  cover_url text,
  duration integer,
  category text,
  tags text[],
  submitted_by uuid references public.user_profiles(id) not null,
  status text default 'pending',
  rejection_reason text,
  plays_count integer default 0,
  likes_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Approved Queue
create table if not exists public.troll_station_queue (
  id uuid primary key default gen_random_uuid(),
  song_id uuid references public.troll_station_songs(id) not null,
  position integer not null,
  added_by uuid references public.user_profiles(id),
  added_at timestamptz default now(),
  played_at timestamptz
);

-- Live Sessions
create table if not exists public.troll_station_sessions (
  id uuid primary key default gen_random_uuid(),
  dj_id uuid references public.user_profiles(id) not null,
  title text,
  description text,
  scheduled_start timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  status text default 'scheduled',
  max_cohosts integer default 3,
  livekit_room_name text,
  is_music_ducking boolean default true,
  created_at timestamptz default now()
);

-- Station Hosts (DJs)
create table if not exists public.troll_station_hosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) not null,
  role text default 'dj',
  can_invite boolean default true,
  can_moderate boolean default true,
  assigned_by uuid references public.user_profiles(id),
  created_at timestamptz default now()
);

-- Cohosts during live sessions
create table if not exists public.troll_station_cohosts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.troll_station_sessions(id) not null,
  user_id uuid references public.user_profiles(id) not null,
  role text default 'guest',
  can_control_queue boolean default false,
  is_speaking boolean default false,
  joined_at timestamptz default now(),
  removed_at timestamptz
);

-- Pending Invitations
create table if not exists public.troll_station_invitations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.troll_station_sessions(id) not null,
  invited_by uuid references public.user_profiles(id) not null,
  invited_user_id uuid references public.user_profiles(id) not null,
  role text default 'guest',
  status text default 'pending',
  created_at timestamptz default now(),
  responded_at timestamptz
);

-- Station Chat Messages
create table if not exists public.troll_station_chat (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.troll_station_sessions(id),
  user_id uuid references public.user_profiles(id) not null,
  message text not null,
  is_system boolean default false,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_station_songs_status on public.troll_station_songs(status);
create index if not exists idx_station_songs_submitted on public.troll_station_songs(submitted_by);
create index if not exists idx_station_queue_position on public.troll_station_queue(position);
create index if not exists idx_station_sessions_status on public.troll_station_sessions(status);
create index if not exists idx_station_sessions_dj on public.troll_station_sessions(dj_id);
create index if not exists idx_station_hosts_user on public.troll_station_hosts(user_id);
create index if not exists idx_station_cohosts_session on public.troll_station_cohosts(session_id);
create index if not exists idx_station_invitations_user on public.troll_station_invitations(invited_user_id);
create index if not exists idx_station_chat_session on public.troll_station_chat(session_id);

-- Enable RLS
alter table public.troll_station enable row level security;
alter table public.troll_station_songs enable row level security;
alter table public.troll_station_queue enable row level security;
alter table public.troll_station_sessions enable row level security;
alter table public.troll_station_hosts enable row level security;
alter table public.troll_station_cohosts enable row level security;
alter table public.troll_station_invitations enable row level security;
alter table public.troll_station_chat enable row level security;

-- RLS Policies - Troll Station
drop policy if exists "Anyone can view station" on public.troll_station;
create policy "Anyone can view station" on public.troll_station for select using (true);

drop policy if exists "Admins can manage station" on public.troll_station;
create policy "Admins can manage station" on public.troll_station for all using (
  exists (select 1 from public.user_profiles where id = auth.uid() and (role = 'admin' or is_admin = true))
);

-- RLS Policies - Songs
drop policy if exists "Anyone can view songs" on public.troll_station_songs;
create policy "Anyone can view songs" on public.troll_station_songs for select using (true);

drop policy if exists "Users can submit songs" on public.troll_station_songs;
create policy "Users can submit songs" on public.troll_station_songs for insert with check (auth.uid() = submitted_by);

drop policy if exists "Users can update own pending songs" on public.troll_station_songs;
create policy "Users can update own pending songs" on public.troll_station_songs for update using (
  auth.uid() = submitted_by and status = 'pending'
);

drop policy if exists "Moderators can manage songs" on public.troll_station_songs;
create policy "Moderators can manage songs" on public.troll_station_songs for all using (
  exists (select 1 from public.user_profiles where id = auth.uid() and (role = 'admin' or role = 'moderator' or is_admin = true))
);

-- RLS Policies - Queue
drop policy if exists "Anyone can view queue" on public.troll_station_queue;
create policy "Anyone can view queue" on public.troll_station_queue for select using (true);

drop policy if exists "Hosts can manage queue" on public.troll_station_queue;
create policy "Hosts can manage queue" on public.troll_station_queue for all using (
  exists (select 1 from public.troll_station_hosts where user_id = auth.uid())
  or exists (select 1 from public.user_profiles where id = auth.uid() and (role = 'admin' or is_admin = true))
);

-- RLS Policies - Sessions
drop policy if exists "Anyone can view sessions" on public.troll_station_sessions;
create policy "Anyone can view sessions" on public.troll_station_sessions for select using (true);

drop policy if exists "Hosts can manage sessions" on public.troll_station_sessions;
create policy "Hosts can manage sessions" on public.troll_station_sessions for all using (
  exists (select 1 from public.troll_station_hosts where user_id = auth.uid())
  or exists (select 1 from public.user_profiles where id = auth.uid() and (role = 'admin' or is_admin = true))
);

-- RLS Policies - Hosts
drop policy if exists "Anyone can view hosts" on public.troll_station_hosts;
create policy "Anyone can view hosts" on public.troll_station_hosts for select using (true);

drop policy if exists "Admins can manage hosts" on public.troll_station_hosts;
create policy "Admins can manage hosts" on public.troll_station_hosts for all using (
  exists (select 1 from public.user_profiles where id = auth.uid() and (role = 'admin' or is_admin = true))
);

-- RLS Policies - Cohosts
drop policy if exists "Session participants can view cohosts" on public.troll_station_cohosts;
create policy "Session participants can view cohosts" on public.troll_station_cohosts for select using (true);

drop policy if exists "Session DJ can manage cohosts" on public.troll_station_cohosts;
create policy "Session DJ can manage cohosts" on public.troll_station_cohosts for all using (
  exists (
    select 1 from public.troll_station_sessions s 
    where s.id = session_id and s.dj_id = auth.uid()
  )
  or exists (select 1 from public.user_profiles where id = auth.uid() and (role = 'admin' or is_admin = true))
);

-- RLS Policies - Invitations
drop policy if exists "Invited users can view invitations" on public.troll_station_invitations;
create policy "Invited users can view invitations" on public.troll_station_invitations for select using (
  auth.uid() = invited_user_id or auth.uid() = invited_by
);

drop policy if exists "DJ can manage invitations" on public.troll_station_invitations;
create policy "DJ can manage invitations" on public.troll_station_invitations for all using (
  exists (
    select 1 from public.troll_station_sessions s 
    where s.id = session_id and s.dj_id = auth.uid()
  )
  or exists (select 1 from public.user_profiles where id = auth.uid() and (role = 'admin' or is_admin = true))
);

-- RLS Policies - Chat
drop policy if exists "Anyone can view chat" on public.troll_station_chat;
create policy "Anyone can view chat" on public.troll_station_chat for select using (true);

drop policy if exists "Authenticated users can chat" on public.troll_station_chat;
create policy "Authenticated users can chat" on public.troll_station_chat for insert with check (auth.uid() = user_id);

drop policy if exists "Hosts can manage chat" on public.troll_station_chat;
create policy "Hosts can manage chat" on public.troll_station_chat for delete using (
  exists (select 1 from public.troll_station_hosts where user_id = auth.uid())
  or exists (select 1 from public.user_profiles where id = auth.uid() and (role in ('admin', 'moderator') or is_admin = true))
);

-- Insert default station record
insert into public.troll_station (id, name, description, is_online, current_mode)
values ('00000000-0000-0000-0000-000000000001', 'Troll Station', 'Troll City Community Radio', false, 'auto')
on conflict (id) do nothing;

-- Add yourself as a host (replace YOUR_USER_ID with your user ID)
-- Run this separately after finding your user ID:
-- insert into public.troll_station_hosts (user_id, role, can_invite, can_moderate)
-- values ('YOUR_USER_ID', 'dj', true, true);
