-- Officer Training System
CREATE TABLE IF NOT EXISTS training_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_type TEXT NOT NULL, -- 'harassment', 'spam', 'scam', 'self_harm', 'minors', etc.
  description TEXT NOT NULL,
  chat_messages JSONB NOT NULL, -- Array of fake chat messages
  correct_action TEXT NOT NULL, -- 'ban', 'warn', 'mute', 'report', 'ignore', 'escalate'
  points_awarded INTEGER DEFAULT 10,
  difficulty_level INTEGER DEFAULT 1, -- 1-5
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS officer_training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES training_scenarios(id) ON DELETE CASCADE,
  action_taken TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  response_time_seconds INTEGER,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_officer ON officer_training_sessions(officer_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_scenario ON officer_training_sessions(scenario_id);

-- Observer Bot System
CREATE TABLE IF NOT EXISTS moderation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'ban', 'mute', 'warn', 'kick', 'shadow_ban'
  reason TEXT NOT NULL,
  context JSONB, -- chat history, gifts, viewer count, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS observer_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES moderation_events(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  verdict TEXT NOT NULL, -- 'correct', 'overreaction', 'underreaction', 'missed_escalation'
  policy_tags TEXT[], -- ['harassment', 'spam', etc.]
  feedback TEXT,
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_events_officer ON moderation_events(officer_id);
CREATE INDEX IF NOT EXISTS idx_moderation_events_stream ON moderation_events(stream_id);
CREATE INDEX IF NOT EXISTS idx_observer_ratings_event ON observer_ratings(event_id);

-- Add officer_reputation_score to user_profiles
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'officer_reputation_score') THEN
    ALTER TABLE user_profiles ADD COLUMN officer_reputation_score INTEGER DEFAULT 100 CHECK (officer_reputation_score >= 0 AND officer_reputation_score <= 200);
  END IF;
END $$;

-- Ghost Mode System
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_ghost_mode') THEN
    ALTER TABLE user_profiles ADD COLUMN is_ghost_mode BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Shadow Ban System
CREATE TABLE IF NOT EXISTS shadow_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shadow_bans_target ON shadow_bans(target_user_id);
CREATE INDEX IF NOT EXISTS idx_shadow_bans_stream ON shadow_bans(stream_id);
CREATE INDEX IF NOT EXISTS idx_shadow_bans_active ON shadow_bans(is_active) WHERE is_active = TRUE;

-- Ghost Mode Activity Tracking
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'officer_live_assignments' AND column_name = 'ghost_mode_active') THEN
    ALTER TABLE officer_live_assignments ADD COLUMN ghost_mode_active BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ghost_presence_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  minutes_in_ghost_mode INTEGER DEFAULT 0,
  events_moderated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS officer_mission_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  mission_type TEXT NOT NULL, -- 'silent_watch', 'shadow_defender', 'stealth_patrol_elite'
  stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
  coins_awarded INTEGER DEFAULT 0,
  reputation_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Punishment System
CREATE TABLE IF NOT EXISTS punishment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  coins_deducted BIGINT NOT NULL,
  reason TEXT NOT NULL,
  appeal_id UUID, -- Can reference ban_appeals if exists
  verdict TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_punishment_transactions_user ON punishment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_punishment_transactions_created ON punishment_transactions(created_at DESC);

-- RPC Functions
CREATE OR REPLACE FUNCTION deduct_user_coins(
  p_user_id UUID,
  p_amount BIGINT,
  p_reason TEXT,
  p_appeal_id UUID,
  p_verdict TEXT
)
RETURNS JSON AS $$
DECLARE
  v_current_balance INTEGER;
  v_deducted INTEGER;
BEGIN
  -- Get current balance
  SELECT free_coin_balance INTO v_current_balance
  FROM user_profiles
  WHERE id = p_user_id;

  -- Calculate actual deduction (can't go below 0)
  v_deducted := LEAST(v_current_balance, p_amount);

  -- Deduct from free coin balance
  UPDATE user_profiles
  SET free_coin_balance = GREATEST(free_coin_balance - p_amount, 0)
  WHERE id = p_user_id;

  -- Log punishment record
  INSERT INTO punishment_transactions (user_id, coins_deducted, reason, appeal_id, verdict)
  VALUES (p_user_id, v_deducted, p_reason, p_appeal_id, p_verdict);

  RETURN json_build_object(
    'success', true,
    'deducted', v_deducted,
    'remaining', GREATEST(v_current_balance - p_amount, 0)
  );
END;
$$ LANGUAGE plpgsql;

-- Function to detect ghost inactivity
CREATE OR REPLACE FUNCTION detect_ghost_inactivity()
RETURNS TABLE (officer_id UUID, session_id UUID) AS $$
SELECT
  ola.officer_id,
  ows.id AS session_id
FROM officer_live_assignments ola
JOIN officer_work_sessions ows ON ola.officer_id = ows.officer_id AND ows.clock_out IS NULL
WHERE ola.ghost_mode_active = TRUE
AND ola.last_activity < NOW() - INTERVAL '20 minutes'
AND ola.status = 'active';
$$ LANGUAGE sql;

-- Seed some training scenarios
INSERT INTO training_scenarios (scenario_type, description, chat_messages, correct_action, points_awarded, difficulty_level)
VALUES
  ('harassment', 'User repeatedly insults another viewer', 
   '[{"username": "TrollUser123", "message": "You are so stupid", "timestamp": "2024-01-01T10:00:00Z"}, {"username": "TrollUser123", "message": "Get out of here loser", "timestamp": "2024-01-01T10:00:15Z"}, {"username": "TrollUser123", "message": "Nobody wants you here", "timestamp": "2024-01-01T10:00:30Z"}]',
   'warn', 10, 1),
  ('spam', 'User sends same message 10 times in a row',
   '[{"username": "SpammerBot", "message": "Check out my website!", "timestamp": "2024-01-01T10:00:00Z"}, {"username": "SpammerBot", "message": "Check out my website!", "timestamp": "2024-01-01T10:00:05Z"}, {"username": "SpammerBot", "message": "Check out my website!", "timestamp": "2024-01-01T10:00:10Z"}]',
   'mute', 10, 1),
  ('scam', 'User trying to sell fake coins',
   '[{"username": "CoinSeller", "message": "DM me for cheap coins! Only $5 for 10k!", "timestamp": "2024-01-01T10:00:00Z"}, {"username": "CoinSeller", "message": "Trust me, I have proof", "timestamp": "2024-01-01T10:00:10Z"}]',
   'ban', 20, 2),
  ('self_harm', 'User mentions self-harm',
   '[{"username": "UserInCrisis", "message": "I want to hurt myself", "timestamp": "2024-01-01T10:00:00Z"}, {"username": "UserInCrisis", "message": "Nobody cares about me", "timestamp": "2024-01-01T10:00:15Z"}]',
   'escalate', 30, 3)
ON CONFLICT DO NOTHING;

