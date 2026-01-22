-- Badge System Migration
-- Creates badge catalog and user badges with RLS and seed data

-- 1) Catalog of all badges
create table if not exists badge_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  category text not null,
  icon_url text null,
  rarity text not null default 'common',
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) User earned badges
create table if not exists user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references badge_catalog(id) on delete cascade,
  earned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(user_id, badge_id)
);

-- Indexes
create index if not exists idx_badge_catalog_category on badge_catalog(category);
create index if not exists idx_badge_catalog_sort on badge_catalog(sort_order);
create index if not exists idx_user_badges_user on user_badges(user_id);
create index if not exists idx_user_badges_badge on user_badges(badge_id);

-- RLS
alter table badge_catalog enable row level security;
alter table user_badges enable row level security;

-- Policies for badge_catalog: public read; mutations only by service role
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'badge_catalog' AND policyname = 'Badge catalog is publicly readable'
    ) THEN
        create policy "Badge catalog is publicly readable" on badge_catalog for select using (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'badge_catalog' AND policyname = 'Badge catalog insert by service role'
    ) THEN
        create policy "Badge catalog insert by service role" on badge_catalog for insert with check (auth.role() = 'service_role');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'badge_catalog' AND policyname = 'Badge catalog update by service role'
    ) THEN
        create policy "Badge catalog update by service role" on badge_catalog for update using (auth.role() = 'service_role');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'badge_catalog' AND policyname = 'Badge catalog delete by service role'
    ) THEN
        create policy "Badge catalog delete by service role" on badge_catalog for delete using (auth.role() = 'service_role');
    END IF;
END $$;

-- Policies for user_badges: public read limited columns; mutations only by service role
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_badges' AND policyname = 'User badges publicly readable'
    ) THEN
        create policy "User badges publicly readable" on user_badges for select using (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_badges' AND policyname = 'User badges insert by service role'
    ) THEN
        create policy "User badges insert by service role" on user_badges for insert with check (auth.role() = 'service_role');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_badges' AND policyname = 'User badges update by service role'
    ) THEN
        create policy "User badges update by service role" on user_badges for update using (auth.role() = 'service_role');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_badges' AND policyname = 'User badges delete by service role'
    ) THEN
        create policy "User badges delete by service role" on user_badges for delete using (auth.role() = 'service_role');
    END IF;
END $$;

-- Grants: expose catalog; expose limited columns for user_badges; keep metadata private
revoke all on badge_catalog from anon, authenticated;
revoke all on user_badges from anon, authenticated;

grant select on badge_catalog to anon, authenticated;
-- Column-level select keeps metadata private
grant select(user_id, badge_id, earned_at) on user_badges to anon, authenticated;

grant all on badge_catalog to service_role;
grant all on user_badges to service_role;

-- Seed catalog (idempotent upsert on slug)
insert into badge_catalog (slug, name, description, category, rarity, sort_order)
values
  ('first-gift', 'First Gift', 'Send your first gift to anyone', 'gifting', 'common', 10),
  ('generous-gifter', 'Generous Gifter', 'Send 10 gifts total', 'gifting', 'common', 20),
  ('big-spender', 'Big Spender', 'Gift 50,000 coins total', 'gifting', 'rare', 30),
  ('community-supporter', 'Community Supporter', 'Gift to 10 unique users', 'gifting', 'rare', 40),
  ('first-loan-repaid', 'First Loan Repaid', 'Repay any loan successfully', 'loans', 'common', 50),
  ('on-time-payer', 'On-Time Payer', 'Make 5 on-time loan payments', 'loans', 'common', 60),
  ('debt-free', 'Debt Free', 'Pay off a loan completely', 'loans', 'rare', 70),
  ('trusted-borrower', 'Trusted Borrower', 'Hold a credit score >= 600 for 14 days', 'trust', 'rare', 80),
  ('elite-reliability', 'Elite Reliability', 'Hold a credit score >= 700 for 30 days', 'trust', 'epic', 90),
  ('first-checkin', 'First Check-In', 'Complete your first daily check-in', 'consistency', 'common', 100),
  ('streak-7', '7-Day Streak', 'Check in for 7 days in a row', 'consistency', 'common', 110),
  ('streak-30', '30-Day Streak', 'Check in for 30 days in a row', 'consistency', 'rare', 120),
  ('first-stream', 'First Stream', 'Host your first stream (20+ minutes)', 'streaming', 'common', 130),
  ('regular-streamer', 'Regular Streamer', 'Stream on 3 different days in a week', 'streaming', 'common', 140),
  ('marathon-stream', 'Marathon Stream', 'Stream for 2 hours in one session', 'streaming', 'rare', 150),
  ('first-reaction', 'First Reaction', 'Give 10 reactions', 'community', 'common', 160),
  ('popular', 'Popular', 'Receive 100 unique reactions', 'community', 'rare', 170),
  ('first-win', 'First Win', 'Win your first TrollCourt case', 'trollcourt', 'common', 180),
  ('court-champion', 'Court Champion', 'Win 10 TrollCourt cases', 'trollcourt', 'epic', 190),
  ('clean-record', 'Clean Record', 'Stay violation-free for 30 days', 'safety', 'rare', 200)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    rarity = excluded.rarity,
    sort_order = excluded.sort_order,
    is_active = true;
