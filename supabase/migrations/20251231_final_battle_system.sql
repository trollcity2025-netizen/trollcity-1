-- Final Battle System & Gift Targeting Schema
-- Part 1: streams_participants with full permissions
CREATE TABLE IF NOT EXISTS streams_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('host', 'opponent', 'guest')),
  battle_side text NULL CHECK (battle_side IN ('A', 'B')),
  can_receive_gifts boolean NOT NULL DEFAULT true,
  can_send_gifts boolean NOT NULL DEFAULT true,
  can_chat boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(stream_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_streams_participants_stream_active ON streams_participants(stream_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_streams_participants_user_id ON streams_participants(user_id);

-- Part 2: battles table (if not exists, update if exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'battles') THEN
    CREATE TABLE battles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      stream_id uuid NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
      host_id uuid NOT NULL REFERENCES user_profiles(id),
      opponent_id uuid REFERENCES user_profiles(id),
      status text NOT NULL CHECK (status IN ('pending', 'active', 'finished', 'cancelled')) DEFAULT 'pending',
      started_at timestamptz NULL,
      ended_at timestamptz NULL,
      host_gift_total bigint NOT NULL DEFAULT 0,
      opponent_gift_total bigint NOT NULL DEFAULT 0,
      winner_side text NULL CHECK (winner_side IN ('A', 'B')),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    
    CREATE INDEX IF NOT EXISTS idx_battles_stream_status ON battles(stream_id, status);
  ELSE
    -- Add missing columns if table exists
    ALTER TABLE battles ADD COLUMN IF NOT EXISTS stream_id uuid REFERENCES streams(id) ON DELETE CASCADE;
    ALTER TABLE battles ADD COLUMN IF NOT EXISTS host_gift_total bigint NOT NULL DEFAULT 0;
    ALTER TABLE battles ADD COLUMN IF NOT EXISTS opponent_gift_total bigint NOT NULL DEFAULT 0;
    ALTER TABLE battles ADD COLUMN IF NOT EXISTS winner_side text CHECK (winner_side IN ('A', 'B'));
    
    CREATE INDEX IF NOT EXISTS idx_battles_stream_status ON battles(stream_id, status) WHERE stream_id IS NOT NULL;
  END IF;
END $$;

-- Part 3: Ensure gifts table has all required columns
DO $$ 
BEGIN
  ALTER TABLE gifts ADD COLUMN IF NOT EXISTS receiver_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE;
  ALTER TABLE gifts ADD COLUMN IF NOT EXISTS battle_id uuid REFERENCES battles(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS idx_gifts_receiver_id ON gifts(receiver_id) WHERE receiver_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_gifts_battle_id ON gifts(battle_id) WHERE battle_id IS NOT NULL;
END $$;

-- Part 4: chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  battle_id uuid REFERENCES battles(id) ON DELETE SET NULL,
  sender_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_stream_created ON chat_messages(stream_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_battle_id ON chat_messages(battle_id) WHERE battle_id IS NOT NULL;

-- Part 5: payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'square',
  customer_id text NOT NULL,
  card_id text NOT NULL,
  brand text NOT NULL,
  last4 text NOT NULL,
  exp_month int NOT NULL,
  exp_year int NOT NULL,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_default ON payment_methods(user_id, is_default) WHERE is_default = true;

-- Part 6: troll_events table
CREATE TABLE IF NOT EXISTS troll_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('red', 'green')),
  coin_reward int NOT NULL DEFAULT 10,
  max_clicks int NOT NULL DEFAULT 9999,
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_troll_events_stream_expires ON troll_events(stream_id, expires_at) WHERE expires_at > now();

-- Part 7: troll_event_claims table
CREATE TABLE IF NOT EXISTS troll_event_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES troll_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_troll_event_claims_event_id ON troll_event_claims(event_id);
CREATE INDEX IF NOT EXISTS idx_troll_event_claims_user_id ON troll_event_claims(user_id);

-- Part 8: badges table
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon_url text,
  created_at timestamptz DEFAULT now()
);

-- Part 9: user_badges table
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);

-- Part 10: Add creator onboarding fields to user_profiles
DO $$ 
BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS legal_full_name text;
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS country text;
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS address_line1 text;
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS address_line2 text;
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS city text;
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS state_region text;
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS postal_code text;
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tax_id_last4 text;
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tax_classification text;
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS w9_status text NOT NULL DEFAULT 'not_started' CHECK (w9_status IN ('not_started', 'in_progress', 'submitted', 'verified', 'rejected'));
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS w9_verified_at timestamptz NULL;
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS entrance_effect_key text;
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
END $$;

-- Part 11: Add heartbeat fields to streams
DO $$ 
BEGIN
  ALTER TABLE streams ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz NULL;
  CREATE INDEX IF NOT EXISTS idx_streams_heartbeat ON streams(is_live, last_heartbeat_at) WHERE is_live = true;
END $$;

-- Part 12: Triggers
CREATE OR REPLACE FUNCTION update_streams_participants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_streams_participants_updated_at ON streams_participants;
CREATE TRIGGER update_streams_participants_updated_at
  BEFORE UPDATE ON streams_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_streams_participants_updated_at();

-- Part 13: RLS Policies
ALTER TABLE streams_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_event_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for streams_participants
CREATE POLICY "Anyone can view active participants"
  ON streams_participants FOR SELECT
  USING (true);

CREATE POLICY "Users can join as participants"
  ON streams_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation"
  ON streams_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for battles
CREATE POLICY "Anyone can view battles"
  ON battles FOR SELECT
  USING (true);

CREATE POLICY "Hosts can create battles"
  ON battles FOR INSERT
  WITH CHECK (auth.uid() = host_id);

-- RLS Policies for chat_messages
CREATE POLICY "Anyone can view chat messages"
  ON chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can send messages"
  ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- RLS Policies for payment_methods
CREATE POLICY "Users can view their own payment methods"
  ON payment_methods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment methods"
  ON payment_methods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment methods"
  ON payment_methods FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for troll_events
CREATE POLICY "Anyone can view active troll events"
  ON troll_events FOR SELECT
  USING (true);

-- RLS Policies for troll_event_claims
CREATE POLICY "Users can view their own claims"
  ON troll_event_claims FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can claim events"
  ON troll_event_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for badges
CREATE POLICY "Anyone can view badges"
  ON badges FOR SELECT
  USING (true);

-- RLS Policies for user_badges
CREATE POLICY "Anyone can view user badges"
  ON user_badges FOR SELECT
  USING (true);

-- Part 14: Insert default badges
INSERT INTO badges (key, name, description, icon_url) VALUES
  ('og', 'OG', 'Original Gangster - Early adopter', '👑'),
  ('admin', 'Admin', 'Platform Administrator', '🛡️'),
  ('troll_officer', 'Troll Officer', 'Community Moderator', '🛡️'),
  ('vip', 'VIP', 'Very Important Person', '⭐'),
  ('partner', 'Partner', 'Troll Empire Partner', '🤝')
ON CONFLICT (key) DO NOTHING;

-- Part 15: Auto-assign OG badge to users created before 2026-01-01
INSERT INTO user_badges (user_id, badge_id)
SELECT 
  up.id,
  b.id
FROM user_profiles up
CROSS JOIN badges b
WHERE b.key = 'og'
  AND up.created_at < '2026-01-01'::timestamptz
  AND NOT EXISTS (
    SELECT 1 FROM user_badges ub 
    WHERE ub.user_id = up.id AND ub.badge_id = b.id
  );

COMMENT ON TABLE streams_participants IS 'Tracks participants in streams with battle sides and permissions';
COMMENT ON TABLE battles IS 'Battle sessions between streamers';
COMMENT ON TABLE payment_methods IS 'Stored payment methods (Square cards)';
COMMENT ON TABLE troll_events IS 'Red/Green troll events in streams';
COMMENT ON TABLE badges IS 'Available badges for users';

