-- WHEEL SPINS TRACKING
-- Track all Troll Wheel spins, costs, outcomes, and prizes

-- Wheel Spins Table
-- Records every spin of the Troll Wheel with outcome and prize details
create table if not exists wheel_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  cost_coins integer not null,
  outcome text not null, -- 'jackpot', 'insurance', 'multiplier', 'nothing', 'free_coins', etc.
  prize_coins integer default 0,
  metadata jsonb default '{}'::jsonb, -- additional details like multiplier value, insurance duration, etc.
  created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_wheel_spins_user
  on wheel_spins(user_id);

create index if not exists idx_wheel_spins_outcome
  on wheel_spins(outcome);

create index if not exists idx_wheel_spins_created
  on wheel_spins(created_at desc);

create index if not exists idx_wheel_spins_user_created
  on wheel_spins(user_id, created_at desc);

-- RLS Policies
alter table wheel_spins enable row level security;

-- Users can view their own spin history
create policy "Users can view own spins"
  on wheel_spins for select
  using (auth.uid() = user_id);

-- Admins can view all spins
create policy "Admins can view all spins"
  on wheel_spins for select
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role = 'admin'
    )
  );

-- Service role can insert spins
create policy "Service can insert spins"
  on wheel_spins for insert
  with check (true);

-- Add helpful comments
comment on table wheel_spins is 'Log of all Troll Wheel spins with outcomes and prizes';
comment on column wheel_spins.user_id is 'ID of the user who spun the wheel';
comment on column wheel_spins.cost_coins is 'Coins paid to spin the wheel';
comment on column wheel_spins.outcome is 'Result type: jackpot, insurance, multiplier, nothing, free_coins, etc.';
comment on column wheel_spins.prize_coins is 'Coins won from the spin (if any)';
comment on column wheel_spins.metadata is 'Additional outcome details (multiplier: 2x, insurance_days: 30, etc.)';
