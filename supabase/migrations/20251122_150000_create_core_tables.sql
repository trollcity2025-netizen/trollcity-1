BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Core profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  avatar_url text,
  bio text,
  role text DEFAULT 'user',
  tier text DEFAULT 'Bronze',
  paid_coin_balance bigint DEFAULT 0 NOT NULL,
  free_coin_balance bigint DEFAULT 0 NOT NULL,
  total_earned_coins bigint DEFAULT 0 NOT NULL,
  total_spent_coins bigint DEFAULT 0 NOT NULL,
  insurance_level text,
  insurance_expires_at timestamptz,
  no_kick_until timestamptz,
  no_ban_until timestamptz,
  platform_fee_last_charged timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Streams and chat
CREATE TABLE IF NOT EXISTS streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,
  status text DEFAULT 'live',
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  current_viewers integer DEFAULT 0,
  total_gifts_coins bigint DEFAULT 0,
  total_unique_gifters integer DEFAULT 0,
  total_free_gifts bigint DEFAULT 0,
  total_earnings_usd numeric(12,2) DEFAULT 0,
  final_viewers integer,
  final_total_coins bigint,
  final_earnings_usd numeric(12,2),
  thumbnail_url text,
  agora_channel text,
  agora_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES streams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  content text,
  message_type text DEFAULT 'chat',
  gift_amount bigint,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_stream_id ON messages(stream_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);

CREATE TABLE IF NOT EXISTS gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES user_profiles(id),
  coins_spent bigint DEFAULT 0 NOT NULL,
  gift_type text,
  message text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gifts_stream_id ON gifts(stream_id);

-- Coins and transactions
CREATE TABLE IF NOT EXISTS coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  package_id text,
  coins bigint DEFAULT 0 NOT NULL,
  amount_usd numeric(12,2) DEFAULT 0 NOT NULL,
  payment_method text,
  status text DEFAULT 'pending',
  description text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coin_tx_user_id ON coin_transactions(user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type text,
  transaction_type text,
  coins_used bigint,
  amount numeric(12,2),
  description text,
  status text,
  payment_method text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coin_packages (
  id text PRIMARY KEY,
  name text NOT NULL,
  coin_amount bigint NOT NULL,
  price numeric(12,2) NOT NULL,
  active boolean DEFAULT true
);

-- Social and notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type text,
  title text,
  message text,
  content text,
  metadata jsonb DEFAULT '{}',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

CREATE TABLE IF NOT EXISTS user_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_follows ON user_follows(follower_id, following_id);

CREATE TABLE IF NOT EXISTS user_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  account_identifier text,
  token text,
  default_method boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_entrance_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  effect_id text NOT NULL REFERENCES entrance_effects(id) ON DELETE CASCADE,
  purchased_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_effect ON user_entrance_effects(user_id, effect_id);

-- Applications, reports, drops, payouts
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  status text DEFAULT 'pending',
  reason text,
  goals text,
  data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  coin_amount bigint NOT NULL,
  cash_amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'USD',
  processing_fee numeric(12,2) DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stream_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES user_profiles(id),
  reason text,
  severity text DEFAULT 'minor',
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS troll_officer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS troll_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  stream_id uuid REFERENCES streams(id) ON DELETE SET NULL,
  drop_type text,
  coin_delta bigint,
  created_at timestamptz DEFAULT now()
);

-- Family-related (duplicate variants and wars)
CREATE TABLE IF NOT EXISTS troll_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  founder_id uuid REFERENCES user_profiles(id),
  emoji text,
  color_theme text,
  family_code text UNIQUE,
  level integer DEFAULT 1,
  total_coins bigint DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS troll_family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES troll_families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  is_royal_troll boolean DEFAULT false,
  rank_name text,
  joined_by text,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_troll_family_members ON troll_family_members(family_id, user_id);

CREATE TABLE IF NOT EXISTS family_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  invite_code text UNIQUE NOT NULL,
  invite_type text DEFAULT 'link',
  created_by uuid REFERENCES user_profiles(id),
  max_uses integer DEFAULT 10,
  uses_count integer DEFAULT 0,
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_family_invites_family ON family_invites(family_id);

CREATE TABLE IF NOT EXISTS family_wars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attacking_family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  defending_family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  war_type text DEFAULT 'standard',
  status text DEFAULT 'pending',
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS troll_family_wars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_family_id uuid NOT NULL REFERENCES troll_families(id) ON DELETE CASCADE,
  defender_family_id uuid NOT NULL REFERENCES troll_families(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  challenger_score integer DEFAULT 0,
  defender_score integer DEFAULT 0,
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Legacy/primary families schema used by UI
CREATE TABLE IF NOT EXISTS families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  founder_id uuid REFERENCES user_profiles(id),
  emoji text,
  color_theme text,
  family_code text UNIQUE,
  is_active boolean DEFAULT true,
  level integer DEFAULT 1,
  total_coins bigint DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  is_royal_troll boolean DEFAULT false,
  rank_name text,
  xp_earned integer DEFAULT 0,
  contribution_points integer DEFAULT 0,
  joined_by text,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_family_members ON family_members(family_id, user_id);

CREATE TABLE IF NOT EXISTS task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL,
  category text,
  title text NOT NULL,
  description text,
  reward_coins bigint DEFAULT 0,
  reward_xp integer DEFAULT 0,
  completion_rules text DEFAULT 'individual',
  max_participants integer DEFAULT 1,
  duration_hours integer DEFAULT 24,
  difficulty text DEFAULT 'medium',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_tasks_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  category text,
  title text NOT NULL,
  description text,
  reward_coins bigint DEFAULT 0,
  reward_xp integer DEFAULT 0,
  completion_rules text DEFAULT 'individual',
  max_participants integer DEFAULT 1,
  duration_hours integer DEFAULT 24,
  difficulty text DEFAULT 'medium',
  deadline timestamptz,
  status text DEFAULT 'active',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES family_tasks_new(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  completion_proof text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_completions_task ON task_completions(task_id);

CREATE TABLE IF NOT EXISTS family_lounge_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id),
  message text NOT NULL,
  message_type text DEFAULT 'chat',
  created_at timestamptz DEFAULT now()
);

-- Entrance effects catalog for purchases
CREATE TABLE IF NOT EXISTS entrance_effects (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  price_coins bigint DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cashout_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_amount bigint NOT NULL,
  cash_amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'USD',
  processing_fee_percentage numeric(6,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Useful view for live streams
CREATE OR REPLACE VIEW live_streams AS
  SELECT * FROM streams WHERE status = 'live';

COMMIT;
