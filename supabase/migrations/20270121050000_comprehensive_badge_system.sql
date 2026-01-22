-- Comprehensive Badge System
-- Adds all level badges, achievement badges, and hidden badges per specification

-- Insert all badge types into badge_catalog (idempotent upsert on slug)

-- ===========================
-- LEVEL BADGES (Automatic)
-- ===========================
insert into badge_catalog (slug, name, description, category, rarity, sort_order)
values
  ('level-10', 'Level 10', 'Reach level 10', 'level', 'common', 1010),
  ('level-50', 'Level 50', 'Reach level 50', 'level', 'common', 1050),
  ('level-100', 'Level 100', 'Reach level 100', 'level', 'rare', 1100),
  ('level-250', 'Level 250', 'Reach level 250', 'level', 'rare', 1250),
  ('level-500', 'Level 500', 'Reach level 500', 'level', 'epic', 1500),
  ('level-750', 'Level 750', 'Reach level 750', 'level', 'epic', 1750),
  ('level-1000', 'Level 1000', 'Reach level 1000', 'level', 'legendary', 2000),
  ('level-1500', 'Level 1500', 'Reach level 1500', 'level', 'legendary', 2500),
  ('level-2000', 'Level 2000', 'Reach level 2000', 'level', 'mythic', 3000)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    rarity = excluded.rarity,
    sort_order = excluded.sort_order,
    is_active = true;

-- ===========================
-- ACHIEVEMENT BADGES - Economy
-- ===========================
insert into badge_catalog (slug, name, description, category, rarity, sort_order)
values
  ('first-spend', 'First Spend', 'Spend your first paid coin', 'economy', 'common', 2010),
  ('whale', 'Whale', 'Spend 100,000 paid coins', 'economy', 'legendary', 2020),
  ('tycoon', 'Tycoon', 'Cash out 5 times successfully', 'economy', 'epic', 2030),
  ('first-gift-sender', 'Generous Starter', 'Send your first live gift', 'economy', 'common', 2040),
  ('gift-master', 'Gift Master', 'Send 1,000 live gifts total', 'economy', 'epic', 2050)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    rarity = excluded.rarity,
    sort_order = excluded.sort_order,
    is_active = true;

-- ===========================
-- ACHIEVEMENT BADGES - Streaming
-- ===========================
insert into badge_catalog (slug, name, description, category, rarity, sort_order)
values
  ('broadcaster', 'Broadcaster', 'Go live 10 times', 'streaming', 'common', 3010),
  ('star', 'Star', 'Reach 1,000 total viewers (cumulative)', 'streaming', 'rare', 3020),
  ('cult', 'Cult Following', 'Have 50 concurrent viewers once', 'streaming', 'epic', 3030),
  ('gift-magnet', 'Gift Magnet', 'Receive 10,000 coins in one stream', 'streaming', 'rare', 3040)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    rarity = excluded.rarity,
    sort_order = excluded.sort_order,
    is_active = true;

-- ===========================
-- ACHIEVEMENT BADGES - Community
-- ===========================
insert into badge_catalog (slug, name, description, category, rarity, sort_order)
values
  ('juror', 'Juror', 'Serve on 10 Troll Court juries', 'community', 'common', 4010),
  ('judge', 'Judge', 'Have 5 rulings accepted', 'community', 'rare', 4020),
  ('enforcer', 'Enforcer', 'File 10 helpful reports', 'community', 'rare', 4030),
  ('chatty', 'Chatty', 'Send 500 chat messages', 'community', 'common', 4040)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    rarity = excluded.rarity,
    sort_order = excluded.sort_order,
    is_active = true;

-- ===========================
-- ACHIEVEMENT BADGES - Social/Flex
-- ===========================
insert into badge_catalog (slug, name, description, category, rarity, sort_order)
values
  ('addict', 'Addict', 'Log in 30 days in a row', 'social', 'rare', 5010),
  ('og', 'OG', 'Account older than 1 year', 'social', 'legendary', 5020),
  ('evolved', 'Evolved', 'Earn 500 total badges', 'social', 'mythic', 5030),
  ('untouchable', 'Untouchable', '6 months with zero violations', 'social', 'legendary', 5040)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    rarity = excluded.rarity,
    sort_order = excluded.sort_order,
    is_active = true;

-- ===========================
-- HIDDEN/RARE BADGES
-- ===========================
insert into badge_catalog (slug, name, description, category, rarity, sort_order)
values
  ('snake-eyes', 'Snake Eyes', 'Exactly $666 in one gift', 'hidden', 'mythic', 6010),
  ('ghost', 'Ghost', 'No profile picture for 6 months', 'hidden', 'rare', 6020),
  ('menace', 'Menace', 'Get banned 3 times', 'hidden', 'legendary', 6030),
  ('resurrected', 'Resurrected', 'Return after 1-year absence', 'hidden', 'epic', 6040),
  ('night-owl', 'Night Owl', 'Stream between 2-5 AM 10 times', 'hidden', 'rare', 6050)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    rarity = excluded.rarity,
    sort_order = excluded.sort_order,
    is_active = true;

-- ===========================
-- LEVEL PERK TRACKING TABLE
-- ===========================
create table if not exists user_level_perks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level int not null,
  perk_type text not null, -- 'custom_emoji', 'chat_glow', 'chat_color', 'chat_animation', 'entrance_effect', 'custom_badge_slot', 'crown', 'animated_avatar', 'city_statue', 'ultimate_flair'
  unlocked_at timestamptz not null default now(),
  unique(user_id, perk_type)
);

create index if not exists idx_user_level_perks_user on user_level_perks(user_id);
create index if not exists idx_user_level_perks_level on user_level_perks(level);

alter table user_level_perks enable row level security;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_level_perks' AND policyname = 'User level perks publicly readable'
    ) THEN
        create policy "User level perks publicly readable" on user_level_perks
          for select using (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_level_perks' AND policyname = 'User level perks insert by service role'
    ) THEN
        create policy "User level perks insert by service role" on user_level_perks
          for insert with check (auth.role() = 'service_role');
    END IF;
END $$;

grant select on user_level_perks to anon, authenticated;
grant all on user_level_perks to service_role;

-- ===========================
-- XP TRANSACTION LOG (for audit/history)
-- ===========================
create table if not exists xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null,
  reason text not null, -- 'paid_coin_spend', 'live_gift_send', 'store_purchase', 'watch_stream', 'chat_message', 'daily_login', '7day_streak', 'go_live', 'viewer_minute', 'gift_received', 'jury_participation', 'ruling_accepted', 'helpful_report'
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_xp_transactions_user on xp_transactions(user_id);
create index if not exists idx_xp_transactions_reason on xp_transactions(reason);
create index if not exists idx_xp_transactions_created on xp_transactions(created_at desc);

alter table xp_transactions enable row level security;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'xp_transactions' AND policyname = 'Users can view own XP transactions'
    ) THEN
        create policy "Users can view own XP transactions" on xp_transactions
          for select using (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'xp_transactions' AND policyname = 'XP transactions insert by service role'
    ) THEN
        create policy "XP transactions insert by service role" on xp_transactions
          for insert with check (auth.role() = 'service_role');
    END IF;
END $$;

grant select on xp_transactions to authenticated;
grant all on xp_transactions to service_role;

