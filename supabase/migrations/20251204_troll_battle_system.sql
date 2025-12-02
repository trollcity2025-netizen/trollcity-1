-- Troll Battle System
-- 2-minute live duels between streamers where paid coins determine victory

-- Battle sessions table
CREATE TABLE IF NOT EXISTS troll_battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  challenger_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  host_stream_id uuid REFERENCES streams(id) ON DELETE SET NULL,
  challenger_stream_id uuid REFERENCES streams(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'countdown', 'active', 'completed', 'cancelled')),
  winner_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  host_paid_coins bigint DEFAULT 0 NOT NULL,
  challenger_paid_coins bigint DEFAULT 0 NOT NULL,
  host_free_coins bigint DEFAULT 0 NOT NULL,
  challenger_free_coins bigint DEFAULT 0 NOT NULL,
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_troll_battles_host_id ON troll_battles(host_id);
CREATE INDEX IF NOT EXISTS idx_troll_battles_challenger_id ON troll_battles(challenger_id);
CREATE INDEX IF NOT EXISTS idx_troll_battles_status ON troll_battles(status);
CREATE INDEX IF NOT EXISTS idx_troll_battles_created_at ON troll_battles(created_at DESC);

-- Battle gifts (tracks gifts sent during battle, distinguishing paid vs free)
CREATE TABLE IF NOT EXISTS troll_battle_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES troll_battles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  receiver_role text NOT NULL CHECK (receiver_role IN ('host', 'challenger')),
  is_paid boolean NOT NULL DEFAULT false,
  amount bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_troll_battle_gifts_battle_id ON troll_battle_gifts(battle_id);
CREATE INDEX IF NOT EXISTS idx_troll_battle_gifts_sender_id ON troll_battle_gifts(sender_id);
CREATE INDEX IF NOT EXISTS idx_troll_battle_gifts_receiver_role ON troll_battle_gifts(receiver_role);

-- Battle history (for profile display)
CREATE TABLE IF NOT EXISTS battle_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES troll_battles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  won boolean NOT NULL,
  paid_coins_received bigint DEFAULT 0 NOT NULL,
  paid_coins_sent bigint DEFAULT 0 NOT NULL,
  battle_duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_battle_history_user_id ON battle_history(user_id);
CREATE INDEX IF NOT EXISTS idx_battle_history_battle_id ON battle_history(battle_id);

-- Battle rewards (trophy badges, multipliers)
CREATE TABLE IF NOT EXISTS battle_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES troll_battles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reward_type text NOT NULL CHECK (reward_type IN ('trophy', 'coin_multiplier', 'badge')),
  reward_value numeric(10,2), -- For multipliers (e.g., 1.10 for 10% bonus)
  badge_name text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_battle_rewards_user_id ON battle_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_battle_rewards_battle_id ON battle_rewards(battle_id);

-- Note: Coin updates are handled by the edge function, not triggers

-- Note: Battle completion is handled by the edge function

-- Enable RLS
ALTER TABLE troll_battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active battles"
  ON troll_battles FOR SELECT
  USING (true);

CREATE POLICY "Broadcasters can create battles"
  ON troll_battles FOR INSERT
  WITH CHECK (
    auth.uid() = host_id OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'broadcaster'))
  );

CREATE POLICY "Anyone can view battle gifts"
  ON battle_gifts FOR SELECT
  USING (true);

CREATE POLICY "Users can send battle gifts"
  ON troll_battle_gifts FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view their battle history"
  ON battle_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their battle rewards"
  ON battle_rewards FOR SELECT
  USING (auth.uid() = user_id);

