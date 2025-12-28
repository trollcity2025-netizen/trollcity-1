-- OFFICER ACTIONS AND EARNINGS TRACKING
-- Track moderation actions (kick, ban, mute) and officer commission earnings

-- Officer Actions Table
-- Records all moderation actions taken by troll officers
create table if not exists officer_actions (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('kick', 'ban', 'mute')),
  reason text,
  related_stream_id uuid,
  fee_coins integer default 0, -- penalty coins charged to target user
  created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_officer_actions_officer
  on officer_actions(officer_id);

create index if not exists idx_officer_actions_target
  on officer_actions(target_user_id);

create index if not exists idx_officer_actions_type
  on officer_actions(action_type);

create index if not exists idx_officer_actions_created
  on officer_actions(created_at desc);

-- RLS Policies for officer_actions
alter table officer_actions enable row level security;

-- Officers can view their own actions
create policy "Officers can view own actions"
  on officer_actions for select
  using (auth.uid() = officer_id);

-- Admins can view all actions
create policy "Admins can view all actions"
  on officer_actions for select
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role = 'admin'
    )
  );

-- Officers and admins can insert actions
create policy "Officers can insert actions"
  on officer_actions for insert
  with check (
    auth.uid() = officer_id
    and exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role in ('troll_officer', 'admin')
    )
  );

-- Officer Earnings Table
-- Records commission earnings from moderation fees
create table if not exists officer_earnings (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid references auth.users(id) on delete cascade,
  action_id uuid references officer_actions(id) on delete cascade,
  commission_coins integer not null,
  usd_value numeric(10,2) not null,
  created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_officer_earnings_officer
  on officer_earnings(officer_id);

create index if not exists idx_officer_earnings_action
  on officer_earnings(action_id);

create index if not exists idx_officer_earnings_created
  on officer_earnings(created_at desc);

-- RLS Policies for officer_earnings
alter table officer_earnings enable row level security;

-- Officers can view their own earnings
create policy "Officers can view own earnings"
  on officer_earnings for select
  using (auth.uid() = officer_id);

-- Admins can view all earnings
create policy "Admins can view all earnings"
  on officer_earnings for select
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role = 'admin'
    )
  );

-- Service role can insert earnings
create policy "Service can insert earnings"
  on officer_earnings for insert
  with check (true);

-- Add helpful comments
comment on table officer_actions is 'Log of all moderation actions (kick, ban, mute) taken by troll officers';
comment on column officer_actions.officer_id is 'ID of the troll officer who performed the action';
comment on column officer_actions.target_user_id is 'ID of the user who was moderated';
comment on column officer_actions.action_type is 'Type of moderation: kick, ban, or mute';
comment on column officer_actions.fee_coins is 'Penalty coins charged to the target user';
comment on column officer_actions.related_stream_id is 'ID of the stream where action occurred (if applicable)';

comment on table officer_earnings is 'Commission earnings for troll officers from moderation fees';
comment on column officer_earnings.commission_coins is 'Officer commission in coins (typically 10% of fee)';
comment on column officer_earnings.usd_value is 'USD value of the commission at time of earning';
comment on column officer_earnings.action_id is 'Reference to the officer action that generated this earning';
