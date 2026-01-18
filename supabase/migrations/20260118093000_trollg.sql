create table if not exists trollg_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  level_at_purchase integer not null,
  fee_amount numeric(18,3) not null default 10000,
  paid_at timestamptz not null default now(),
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

create table if not exists user_gifts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  config jsonb not null,
  status text not null default 'draft',
  vote_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id)
);

create index if not exists idx_user_gifts_status on user_gifts(status);

create table if not exists gift_votes (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references user_gifts(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (gift_id, voter_id)
);

create table if not exists gift_sends (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references user_gifts(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid,
  stream_id uuid,
  coins_spent numeric(18,3) not null,
  creator_royalty numeric(18,3) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_gift_sends_gift_id on gift_sends(gift_id);

create table if not exists coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta numeric(18,3) not null,
  reason text not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_coin_ledger_user_id on coin_ledger(user_id);

create table if not exists admin_pool_ledger (
  id uuid primary key default gen_random_uuid(),
  amount numeric(18,3) not null,
  reason text not null,
  ref_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists vote_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  gift_id uuid references user_gifts(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_vote_events_active on vote_events(is_active, event_type);

create table if not exists user_event_dismissals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references vote_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

alter table trollg_applications enable row level security;
alter table user_gifts enable row level security;
alter table gift_votes enable row level security;
alter table gift_sends enable row level security;
alter table coin_ledger enable row level security;
alter table admin_pool_ledger enable row level security;
alter table vote_events enable row level security;
alter table user_event_dismissals enable row level security;

create policy "Users can view own TrollG application" on trollg_applications
  for select
  using (auth.uid() = user_id);

create policy "Users can view submitted and approved gifts" on user_gifts
  for select
  using (status in ('submitted', 'approved'));

create policy "Creators can manage own gifts" on user_gifts
  for all
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

create policy "Users can view all gift votes" on gift_votes
  for select
  using (true);

create policy "Users can insert own gift votes" on gift_votes
  for insert
  with check (auth.uid() = voter_id);

create policy "Users can view their coin ledger" on coin_ledger
  for select
  using (auth.uid() = user_id);

create policy "Users can view active vote events" on vote_events
  for select
  using (is_active = true);

create policy "Users can insert their event dismissals" on user_event_dismissals
  for insert
  with check (auth.uid() = user_id);

create policy "Users can view their event dismissals" on user_event_dismissals
  for select
  using (auth.uid() = user_id);
