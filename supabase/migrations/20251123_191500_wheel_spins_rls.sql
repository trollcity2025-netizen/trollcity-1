create table if not exists wheel_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(id) on delete cascade,
  spin_date date not null,
  spin_count int default 0
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'wheel_spins'
      AND column_name = 'spin_date'
  ) THEN
    ALTER TABLE wheel_spins ADD COLUMN spin_date date;
  END IF;
END $$;
create unique index if not exists uniq_wheel_spins_user_date on wheel_spins(user_id, spin_date);
alter table wheel_spins enable row level security;
create policy "Users can view own wheel_spins" on wheel_spins for select using (auth.uid() = user_id);
create policy "Users can insert own wheel_spins" on wheel_spins for insert with check (auth.uid() = user_id);
create policy "Users can update own wheel_spins" on wheel_spins for update using (auth.uid() = user_id);
